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
  const invoice = searchParams.get("invoice");
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (invoice) filter.invoice = invoice;
  const items = await Payment.find(filter).populate("invoice", "invoiceId").populate("customer", "companyName").sort({ createdAt: -1 }).lean();
  return NextResponse.json({ items });
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
