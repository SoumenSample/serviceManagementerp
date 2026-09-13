import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { Payment } from "@/models/Payment";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "payment.view") && !hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await Payment.findById(id)
    .populate("invoice", "invoiceId totalAmount paidAmount paymentStatus dueDate invoiceDate customer")
    .populate("customer", "companyName customerId")
    .populate("receivedBy", "name email")
    .lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Enrich invoice outstanding if populated
  const inv = (doc as unknown as { invoice?: { totalAmount: number; paidAmount: number; dueDate?: string } }).invoice;
  const invoiceExtra = inv ? { outstanding: inv.totalAmount - inv.paidAmount, overdue: inv.dueDate && new Date(inv.dueDate) < new Date() && inv.totalAmount - inv.paidAmount > 0 } : {};
  return NextResponse.json({ ...doc, invoiceExtra });
}
