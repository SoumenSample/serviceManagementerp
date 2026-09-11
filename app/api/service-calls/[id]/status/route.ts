import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { statusUpdateSchema } from "@/lib/validators";
import { isValidTransition, getNextAction } from "@/lib/servicecall-helpers";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.update") && !hasPermission(auth.role, "serviceCall.close") && !hasPermission(auth.role, "serviceCall.reopen")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const doc = await ServiceCall.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = doc.currentStatus;
  const to = parsed.data.status;
  if (from === to) return NextResponse.json({ error: "Already in this status" }, { status: 400 });
  if (!isValidTransition(from as never, to as never)) return NextResponse.json({ error: `Invalid transition ${from} → ${to}` }, { status: 400 });

  // Permission checks for specific transitions — WORK_COMPLETED is management-only (engineer cannot mark overall work completed)
  if (to === "WORK_COMPLETED" && !hasPermission(auth.role, "serviceCall.close")) return NextResponse.json({ error: "Forbidden: only manager/coordinator/super_admin can mark work completed" }, { status: 403 });
  if (to === "CUSTOMER_CONFIRMATION" && !hasPermission(auth.role, "serviceCall.close")) return NextResponse.json({ error: "Forbidden customer confirmation" }, { status: 403 });
  if (to === "CLOSED" && !hasPermission(auth.role, "serviceCall.close")) return NextResponse.json({ error: "Forbidden close" }, { status: 403 });
  if (to === "REOPENED" && !hasPermission(auth.role, "serviceCall.reopen")) return NextResponse.json({ error: "Forbidden reopen" }, { status: 403 });
  if (to === "ASSIGNED" && !hasPermission(auth.role, "serviceCall.assign")) return NextResponse.json({ error: "Forbidden assign" }, { status: 403 });

  doc.currentStatus = to as never;
  doc.statusHistory.push({ status: to as never, date: new Date(), updatedBy: auth.sub as never, remarks: parsed.data.remarks });
  doc.nextAction = getNextAction(to as never);

  // SLA tracking
  if (to === "ENGINEER_VISITED" && !doc.actualVisitDate) doc.actualVisitDate = new Date();
  if (to === "CLOSED" && !doc.actualResolutionDate) doc.actualResolutionDate = new Date();

  await doc.save();

  // Audit: status transition
  const statusAction = to === "ASSIGNED" ? "ASSIGN" : to === "CANCELLED" ? "CANCEL" : to === "REOPENED" ? "REOPEN" : to === "CLOSED" ? "CLOSE" : "STATUS_CHANGE";
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: statusAction as never,
    module: "SERVICE_CALL",
    recordId: doc.callId,
    recordObjectId: String(doc._id),
    recordType: "ServiceCall",
    description: `Service call ${doc.callId} status changed from ${from} to ${to}`,
    before: { status: from } as unknown as Record<string, unknown>,
    after: { status: to, remarks: parsed.data.remarks || null } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  // Notifications (fire-and-forget, never corrupt business state)
  try {
    const { notify } = await import("@/lib/notifications/notification-service");
    const { getCompanySettings } = await import("@/lib/company-settings");
    const companySettings = await getCompanySettings();
    if (to === "WORK_COMPLETED") {
      const { workCompletedCustomerTemplate } = await import("@/lib/notifications/templates");
      const customer = await (await import("@/models/Customer")).Customer.findById(doc.customer);
      if (customer?.email) {
        const tpl = workCompletedCustomerTemplate({ customerName: customer.companyName, callId: doc.callId }, companySettings);
        notify({ eventType: "WORK_COMPLETED", channel: "EMAIL", title: tpl.subject, message: tpl.html, recipientCustomerEmail: customer.email, relatedModule: "ServiceCall", relatedRecordId: String(doc._id), serviceCall: String(doc._id), dedupKey: `WORK_COMPLETED:${doc._id}:EMAIL:${customer.email}`, email: { to: customer.email, subject: tpl.subject, html: tpl.html } }).catch(() => {});
      }
      const { User } = await import("@/models/User");
      const staff = await User.find({ role: { $in: ["manager", "coordinator", "super_admin"] }, isActive: true }).select("_id").lean();
      for (const u of staff) notify({ eventType: "WORK_COMPLETED", channel: "IN_APP", title: "Work Completed", message: `${doc.callId} marked work completed`, recipientUser: String(u._id), relatedModule: "ServiceCall", relatedRecordId: String(doc._id), serviceCall: String(doc._id), dedupKey: `WORK_COMPLETED:${doc._id}:IN_APP:${u._id}` }).catch(() => {});
    }
    if (to === "CLOSED") {
      const { callClosedCustomerTemplate } = await import("@/lib/notifications/templates");
      const customer = await (await import("@/models/Customer")).Customer.findById(doc.customer);
      const site = await (await import("@/models/Site")).Site.findById(doc.site);
      const eq = doc.equipment ? await (await import("@/models/Equipment")).Equipment.findById(doc.equipment) : null;
      const eng = doc.assignedEngineer ? await (await import("@/models/User")).User.findById(doc.assignedEngineer) : null;
      if (customer?.email) {
        const tpl = callClosedCustomerTemplate({ customerName: customer.companyName, callId: doc.callId, equipmentId: eq?.equipmentId || "", siteName: site?.siteName || "", completionDate: new Date().toLocaleDateString(), technicianName: eng?.name || "" }, companySettings);
        notify({ eventType: "CALL_CLOSED", channel: "EMAIL", title: tpl.subject, message: tpl.html, recipientCustomerEmail: customer.email, relatedModule: "ServiceCall", relatedRecordId: String(doc._id), serviceCall: String(doc._id), dedupKey: `CALL_CLOSED:${doc._id}:EMAIL:${customer.email}`, email: { to: customer.email, subject: tpl.subject, html: tpl.html } }).catch(() => {});
      }
    }
    if (to === "PARTS_REQUIRED") {
      const { User } = await import("@/models/User");
      const staff = await User.find({ role: { $in: ["manager", "coordinator"] }, isActive: true }).select("_id").lean();
      for (const u of staff) notify({ eventType: "PARTS_REQUIRED", channel: "IN_APP", title: "Parts Required", message: `${doc.callId} requires parts`, recipientUser: String(u._id), relatedModule: "ServiceCall", relatedRecordId: String(doc._id), serviceCall: String(doc._id), dedupKey: `PARTS_REQUIRED:${doc._id}:IN_APP:${u._id}` }).catch(() => {});
      if (doc.assignedEngineer) notify({ eventType: "PARTS_REQUIRED", channel: "IN_APP", title: "Parts Required", message: `${doc.callId} parts required`, recipientUser: String(doc.assignedEngineer), relatedModule: "ServiceCall", relatedRecordId: String(doc._id), serviceCall: String(doc._id), dedupKey: `PARTS_REQUIRED:${doc._id}:IN_APP:${doc.assignedEngineer}` }).catch(() => {});
    }
  } catch {}

  return NextResponse.json(doc);
}
