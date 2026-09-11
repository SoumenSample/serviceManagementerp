import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { ServiceExpense } from "@/models/ServiceExpense";
import { isValidExpenseTransition } from "@/lib/expense-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const status = body.status as string;
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });
  await connectDB();
  const { id } = await params;
  const exp = await ServiceExpense.findById(id);
  if (!exp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const beforeStatus = exp.status;
  if (!isValidExpenseTransition(exp.status, status)) return NextResponse.json({ error: `Invalid transition ${exp.status}→${status}` }, { status: 400 });

  if (status === "APPROVED") {
    if (!hasPermission(auth.role, "expense.approve") && !hasPermission(auth.role, "expense.reject")) return NextResponse.json({ error: "Forbidden approve" }, { status: 403 });
    if (String(exp.submittedBy) === String(auth.sub)) return NextResponse.json({ error: "Cannot approve own expense" }, { status: 403 });
    exp.approvedBy = auth.sub as never;
    exp.approvalDate = new Date();
  }
  if (status === "REJECTED") {
    if (!hasPermission(auth.role, "expense.approve") && !hasPermission(auth.role, "expense.reject")) return NextResponse.json({ error: "Forbidden reject" }, { status: 403 });
    if (String(exp.submittedBy) === String(auth.sub)) return NextResponse.json({ error: "Cannot reject own expense" }, { status: 403 });
    if (!body.remarks || !String(body.remarks).trim()) return NextResponse.json({ error: "Rejection remark required" }, { status: 400 });
    exp.remarks = String(body.remarks).trim();
  }
  if (status === "SUBMITTED" && beforeStatus === "REJECTED") {
    // Re-apply: only original submitter or engineer with create permission
    if (String(exp.submittedBy) !== String(auth.sub) && !hasPermission(auth.role, "expense.create")) return NextResponse.json({ error: "Only submitter can re-apply rejected expense" }, { status: 403 });
    // Clear previous approval/rejection metadata for resubmission
    exp.approvedBy = undefined as never;
    exp.approvalDate = undefined as never;
    // Keep remarks as rejection history but allow new submission; optional new remarks can be provided
    if (body.remarks) exp.remarks = String(body.remarks).trim();
  }
  if (status === "CANCELLED" && String(exp.submittedBy) !== String(auth.sub) && !hasPermission(auth.role, "expense.approve") && !hasPermission(auth.role, "expense.reject")) return NextResponse.json({ error: "Forbidden cancel" }, { status: 403 });

  exp.status = status;
  await exp.save();
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: status === "APPROVED" ? "APPROVE" : status === "REJECTED" ? "REJECT" : status === "CANCELLED" ? "CANCEL" : "STATUS_CHANGE",
    module: "EXPENSE",
    recordId: exp.expenseId,
    recordObjectId: String(exp._id),
    recordType: "ServiceExpense",
    description: `Expense ${exp.expenseId} status changed from ${beforeStatus} to ${status}`,
    before: { status: beforeStatus } as unknown as Record<string, unknown>,
    after: { status } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json(exp);
}
