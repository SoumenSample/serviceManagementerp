import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { Invoice } from "@/models/Invoice";
import { isOverdue } from "@/lib/expense-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "invoice.view") && !hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; await connectDB();
  const doc = await Invoice.findById(id).populate("customer", "companyName customerId").populate("amcContract", "amcId").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = doc as unknown as { dueDate?: string; totalAmount: number; paidAmount: number; paymentStatus: string };
  return NextResponse.json({ ...doc, outstanding: d.totalAmount - d.paidAmount, overdue: isOverdue(d.dueDate, d.totalAmount - d.paidAmount) });
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "invoice.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();
  const inv = await Invoice.findById(id);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (["PAID", "CANCELLED"].includes(inv.paymentStatus)) return NextResponse.json({ error: `Cannot edit ${inv.paymentStatus} invoice` }, { status: 400 });
  // Only allow status to ISSUED or notes change; amount immutable after issued
  if (body.paymentStatus === "ISSUED" && inv.paymentStatus === "DRAFT") inv.paymentStatus = "ISSUED";
  if (body.paymentStatus === "CANCELLED" && !hasPermission(auth.role, "invoice.cancel")) return NextResponse.json({ error: "Forbidden cancel" }, { status: 403 });
  if (body.paymentStatus === "CANCELLED") inv.paymentStatus = "CANCELLED";
  if (body.notes !== undefined) inv.notes = body.notes;
  inv.updatedBy = auth.sub as never;
  await inv.save();
  return NextResponse.json(inv);
}
