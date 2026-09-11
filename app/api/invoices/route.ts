import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { Invoice } from "@/models/Invoice";
import { Customer } from "@/models/Customer";
import { invoiceSchema } from "@/lib/validators";
import { genInvoiceId } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "invoice.view") && !hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const customer = searchParams.get("customer");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (customer) filter.customer = customer;
  if (status) filter.paymentStatus = status;
  const [items, total] = await Promise.all([
    Invoice.find(filter).populate("customer", "companyName customerId").populate("amcContract", "amcId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter),
  ]);
  const enriched = (items as unknown as { dueDate?: string; totalAmount: number; paidAmount: number }[]).map((i) => ({
    ...i,
    outstanding: i.totalAmount - i.paidAmount,
    overdue: i.dueDate && new Date(i.dueDate) < new Date() && i.totalAmount - i.paidAmount > 0,
  }));
  return NextResponse.json({ items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "invoice.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const customer = await Customer.findById(parsed.data.customer);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  const amount = parsed.data.amount;
  const tax = parsed.data.taxAmount || 0;
  const total = amount + tax;
  const invoiceId = await genInvoiceId();
  const doc = await Invoice.create({
    invoiceId,
    customer: parsed.data.customer,
    amcContract: parsed.data.amcContract || undefined,
    serviceCall: parsed.data.serviceCall || undefined,
    invoiceDate: new Date(parsed.data.invoiceDate),
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    amount,
    taxAmount: tax,
    totalAmount: total,
    paidAmount: 0,
    paymentStatus: "DRAFT",
    notes: parsed.data.notes,
    createdBy: auth.sub,
    updatedBy: auth.sub,
  });
    createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "INVOICE",
    recordId: (doc as any).invoiceId || String((doc as any)._id),
    recordObjectId: String((doc as any)._id),
    recordType: "Invoice",
    description: `Invoice ${(doc as any).invoiceId} created`,
    after: { invoiceId: (doc as any).invoiceId, amount: (doc as any).totalAmount } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(()=>{});
return NextResponse.json(doc, { status: 201 });
}
