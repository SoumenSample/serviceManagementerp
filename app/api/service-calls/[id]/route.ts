import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { Customer } from "@/models/Customer";
import { Site } from "@/models/Site";
import { Equipment } from "@/models/Equipment";
import { User } from "@/models/User";
import { getNextAction } from "@/lib/servicecall-helpers";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

// Ensure models are registered for populate (prevents MissingSchemaError in Next.js isolated module graph)
void Customer;
void Site;
void Equipment;
void User;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await ServiceCall.findById(id)
    .populate("customer", "companyName customerId contactPerson mobile email")
    .populate("site", "siteName siteId siteAddress city")
    .populate("equipment", "equipmentId assetId make model serialNumber")
    .populate("assignedEngineer", "name email")
    .populate("createdBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .lean() as unknown as Record<string, unknown>;
  // Manually populate assignmentHistory if present (handle hot-reload / strictPopulate)
  if (doc && Array.isArray((doc as { assignmentHistory?: unknown[] }).assignmentHistory) && (doc as { assignmentHistory: { engineer: unknown }[] }).assignmentHistory.length) {
    try {
      // @ts-ignore
      await ServiceCall.populate(doc as never, [{ path: "assignmentHistory.engineer", select: "name email", strictPopulate: false }, { path: "assignmentHistory.assignedBy", select: "name email", strictPopulate: false }]);
    } catch {}
  }
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.update") && !hasPermission(auth.role, "serviceCall.assign")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();
  const doc = await ServiceCall.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only allow editing non-status fields: assignedEngineer, target dates, priority, problemDescription
  if (body.assignedEngineer !== undefined) {
    if (!hasPermission(auth.role, "serviceCall.assign")) return NextResponse.json({ error: "Forbidden assign" }, { status: 403 });
    const prev = String(doc.assignedEngineer || "");
    const next = String(body.assignedEngineer || "");
    if (prev !== next) {
      doc.assignedEngineer = body.assignedEngineer || undefined;
      doc.assignmentHistory.push({ engineer: body.assignedEngineer as never, assignedAt: new Date(), assignedBy: auth.sub as never, reason: body.assignmentReason || "Reassignment" });
      if (body.assignedEngineer && doc.currentStatus === "NEW") {
        doc.currentStatus = "ASSIGNED";
        doc.statusHistory.push({ status: "ASSIGNED", date: new Date(), updatedBy: auth.sub as never, remarks: "Engineer assigned" });
        doc.nextAction = getNextAction("ASSIGNED");
      }
    }
  }
  if (body.targetVisitDate !== undefined) doc.targetVisitDate = body.targetVisitDate ? new Date(body.targetVisitDate) : undefined;
  if (body.targetResolutionDate !== undefined) doc.targetResolutionDate = body.targetResolutionDate ? new Date(body.targetResolutionDate) : undefined;
  if (body.priority) doc.priority = body.priority;
  if (body.problemDescription) doc.problemDescription = body.problemDescription;

  await doc.save();

  // Audit: assignment/update
  if (body.assignedEngineer !== undefined) {
    const prevEng = String((doc.assignmentHistory[doc.assignmentHistory.length - 2] as unknown as { engineer: unknown })?.engineer || "");
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: body.assignedEngineer ? "ASSIGN" : "UNASSIGN",
      module: "SERVICE_CALL",
      recordId: doc.callId,
      recordObjectId: String(doc._id),
      recordType: "ServiceCall",
      description: body.assignedEngineer ? `Service call ${doc.callId} assigned to engineer` : `Service call ${doc.callId} unassigned`,
      before: prevEng ? { assignedEngineer: prevEng } as unknown as Record<string, unknown> : null,
      after: { assignedEngineer: body.assignedEngineer || null } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
  } else if (body.priority || body.targetVisitDate || body.problemDescription) {
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "UPDATE",
      module: "SERVICE_CALL",
      recordId: doc.callId,
      recordObjectId: String(doc._id),
      recordType: "ServiceCall",
      description: `Service call ${doc.callId} updated`,
      after: { priority: body.priority, targetVisitDate: body.targetVisitDate, problemDescription: body.problemDescription } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
  }

  // Notification: ENGINEER_ASSIGNED
  if (body.assignedEngineer) {
    try {
      const { notify } = await import("@/lib/notifications/notification-service");
      const isReassign = !!doc.assignmentHistory.find((h) => String(h.engineer) === String(body.assignedEngineer));
      // In-app to assigned engineer
      notify({
        eventType: "ENGINEER_ASSIGNED",
        channel: "IN_APP",
        title: isReassign ? "Service Call Reassigned" : "New Service Call Assigned",
        message: `${doc.callId} has been ${isReassign ? "reassigned to you" : "assigned to you"}.`,
        recipientUser: String(body.assignedEngineer),
        relatedModule: "ServiceCall",
        relatedRecordId: String(doc._id),
        serviceCall: String(doc._id),
        dedupKey: `ENGINEER_ASSIGNED:${doc._id}:${body.assignedEngineer}:${Date.now()}`,
      }).catch(() => {});
    } catch {}
  }

  return NextResponse.json(doc);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.close") && auth.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await ServiceCall.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Hard delete only — no soft cancel via DELETE. Use status transition to CANCELLED if needed.
  if (auth.role !== "super_admin" && auth.role !== "manager") return NextResponse.json({ error: "Only super_admin/manager can delete service calls" }, { status: 403 });
  await ServiceCall.findByIdAndDelete(id);
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "DELETE",
    module: "SERVICE_CALL",
    recordId: doc.callId,
    recordObjectId: String(doc._id),
    recordType: "ServiceCall",
    description: `Service call ${doc.callId} deleted`,
    before: { status: doc.currentStatus } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
