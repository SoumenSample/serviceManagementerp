import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { paymentSchema } from "@/lib/validators";
import { genPaymentId } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "payment.view") && !hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const invoice = searchParams.get("invoice");
  const customer = searchParams.get("customer");
  const paymentMethod = searchParams.get("paymentMethod");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (invoice) filter.invoice = invoice;
  if (customer) filter.customer = customer;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (from || to) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    filter.paymentDate = dateFilter;
  }
  if (q) {
    // Cheap server-side search on indexed fields; invoiceId/customer search handled via lookup below
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" };
    // For invoiceId/customer text search we need to resolve ids first
    const [invIds, custIds] = await Promise.all([
      Invoice.find({ invoiceId: regex }).select("_id").limit(20).lean().then((r) => r.map((x: unknown) => (x as { _id: unknown })._id)),
      (await import("@/models/Customer")).Customer.find({ $or: [{ companyName: regex }, { customerId: regex }] }).select("_id").limit(20).lean().then((r) => r.map((x: unknown) => (x as { _id: unknown })._id)),
    ]);
    const or: Record<string, unknown>[] = [{ paymentId: regex }, { referenceNumber: regex }];
    if (invIds.length) or.push({ invoice: { $in: invIds } });
    if (custIds.length) or.push({ customer: { $in: custIds } });
    filter.$or = or;
  }

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate("invoice", "invoiceId totalAmount paidAmount paymentStatus dueDate")
      .populate("customer", "companyName customerId")
      .populate("receivedBy", "name email")
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  // Enrich with derived customer/invoice display helpers (already populated)
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "payment.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const inv = await Invoice.findById(parsed.data.invoice);
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 400 });
  if (inv.paymentStatus === "CANCELLED") return NextResponse.json({ error: "Cannot pay cancelled invoice" }, { status: 400 });
  const outstanding = inv.totalAmount - inv.paidAmount;
  if (parsed.data.amount > outstanding) return NextResponse.json({ error: `Payment exceeds outstanding ${outstanding}` }, { status: 400 });
  if (parsed.data.amount <= 0) return NextResponse.json({ error: "Amount must be >0" }, { status: 400 });

  // Atomic update paidAmount
  const updated = await Invoice.findOneAndUpdate(
    { _id: inv._id, totalAmount: { $gte: inv.paidAmount + parsed.data.amount } },
    { $inc: { paidAmount: parsed.data.amount } },
    { new: true }
  );
  if (!updated) return NextResponse.json({ error: "Concurrent update failed" }, { status: 409 });

  const newOutstanding = updated.totalAmount - updated.paidAmount;
  if (newOutstanding === 0) updated.paymentStatus = "PAID";
  else if (updated.paidAmount > 0) updated.paymentStatus = "PARTIAL";
  // Overdue computed later via helper, but keep ISSUED if not paid
  await updated.save();

  const paymentId = await genPaymentId();
  const payment = await Payment.create({
    paymentId,
    invoice: parsed.data.invoice,
    customer: inv.customer,
    amount: parsed.data.amount,
    paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : new Date(),
    paymentMethod: parsed.data.paymentMethod,
    referenceNumber: parsed.data.referenceNumber,
    receivedBy: auth.sub,
    remarks: parsed.data.remarks,
  });
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "PAYMENT",
    module: "PAYMENT",
    recordId: paymentId,
    recordObjectId: String(payment._id),
    recordType: "Payment",
    description: `Payment ${paymentId} of ₹${parsed.data.amount} recorded for invoice ${inv.invoiceId}`,
    after: { paymentId, amount: parsed.data.amount, invoice: inv.invoiceId } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json(payment, { status: 201 });
}
