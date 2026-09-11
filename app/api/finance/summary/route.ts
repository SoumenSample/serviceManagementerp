import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { Invoice } from "@/models/Invoice";
import { ServiceExpense } from "@/models/ServiceExpense";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const invoices = await Invoice.find({ paymentStatus: { $ne: "CANCELLED" } }).lean();
  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const outstanding = totalInvoiced - totalPaid;
  const overdue = invoices.filter((i) => i.dueDate && new Date(i.dueDate) < new Date() && i.totalAmount - i.paidAmount > 0).reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);

  const pendingExpenses = await ServiceExpense.countDocuments({ status: "SUBMITTED" });
  const approvedExpenses = await ServiceExpense.find({ status: "APPROVED" }).lean() as unknown as { amount: number; costSource: string; category: string }[];
  const totalApproved = approvedExpenses.reduce((s, e) => s + e.amount, 0);
  const fieldApproved = approvedExpenses.filter((e) => (e.costSource || "FIELD") === "FIELD").reduce((s, e) => s + e.amount, 0);
  const serviceCenterApproved = approvedExpenses.filter((e) => e.costSource === "SERVICE_CENTER").reduce((s, e) => s + e.amount, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthExpenses = await ServiceExpense.find({ status: "APPROVED", expenseDate: { $gte: monthStart } }).lean() as unknown as { amount: number; category: string; costSource: string }[];
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthField = monthExpenses.filter((e) => (e.costSource || "FIELD") === "FIELD").reduce((s, e) => s + e.amount, 0);
  const monthServiceCenter = monthExpenses.filter((e) => e.costSource === "SERVICE_CENTER").reduce((s, e) => s + e.amount, 0);
  const byCategory = (cat: string) => monthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    revenue: { totalInvoiced, totalPaid, outstanding, overdue },
    expenses: { pendingApproval: pendingExpenses, totalApproved, monthTotal, field: fieldApproved, serviceCenter: serviceCenterApproved, monthField, monthServiceCenter, parts: byCategory("PARTS"), travel: byCategory("TRAVEL"), labour: byCategory("LABOUR"), other: monthTotal - byCategory("PARTS") - byCategory("TRAVEL") - byCategory("LABOUR") },
  });
}
