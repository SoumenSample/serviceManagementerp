// AUDIT TIMELINE TEMPORARILY HIDDEN — file preserved, hidden per request
// @ts-nocheck
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { AuditLog } from "@/models/AuditLog";
import { ServiceVisit } from "@/models/ServiceVisit";
import { PartRequest } from "@/models/PartRequest";

// AUDIT TIMELINE TEMPORARILY HIDDEN — not deleted, just commented/hidden per request
// To re-enable, remove the early return below
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // TEMPORARILY HIDDEN — keep function but hide feature
  return NextResponse.json({ callId: null, audits: [], visits: [], partRequests: [], statusHistory: [], assignmentHistory: [], timeline: [], hidden: true, message: "Activity timeline temporarily hidden" });
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const sc = await ServiceCall.findById(id).lean();
  if (!sc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Engineer scoping: only assigned or created
  if (auth.role === "engineer" && String(sc.assignedEngineer) !== String(auth.sub)) {
    return NextResponse.json({ error: "Forbidden: not assigned to this call" }, { status: 403 });
  }

  // Fetch audit logs for this call — by business callId and objectId
  const audits = await AuditLog.find({
    $or: [{ recordId: sc.callId }, { recordObjectId: sc._id }, { recordId: String(sc._id) }],
    module: { $in: ["SERVICE_CALL", "SERVICE_VISIT", "PART_REQUEST", "EXPENSE", "INVENTORY"] },
  })
    .populate("actor", "name email role")
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  // Also fetch visits and partRequests for richer timeline if not already via audit
  const visits = await ServiceVisit.find({ serviceCall: id }).populate("engineer", "name").sort({ createdAt: 1 }).lean();
  const partRequests = await PartRequest.find({ serviceCall: id }).populate("part", "partNumber name").sort({ createdAt: 1 }).lean();

  // Merge statusHistory and assignmentHistory from ServiceCall itself (already in sc)
  const statusHistory = ((sc.statusHistory || []) as unknown as { status: string; date: Date; remarks?: string }[]).map((h) => ({
    type: "STATUS_HISTORY",
    timestamp: h.date,
    description: `Status: ${h.status}${h.remarks ? ` — ${h.remarks}` : ""}`,
    data: h,
  }));

  const assignmentHistory = ((sc.assignmentHistory || []) as unknown as { engineer: unknown; assignedAt: Date; reason?: string; visitId?: string }[]).map((h) => ({
    type: "ASSIGNMENT_HISTORY",
    timestamp: h.assignedAt,
    description: `Assigned ${h.visitId ? `• visit ${h.visitId}` : ""} ${h.reason ? `— ${h.reason}` : ""}`,
    data: h,
  }));

  // Build timeline events: audits are primary, but supplement with visits/partRequests that may not have audit yet
  const auditEvents = audits.map((a) => ({
    type: "AUDIT",
    timestamp: a.createdAt,
    description: a.description,
    action: a.action,
    module: a.module,
    actor: a.actorName || (a.actor as unknown as { name: string })?.name || a.actorEmail || "System",
    data: a,
  }));

  const visitEvents = (visits as unknown as { visitId: string; status: string; visitPurpose?: string; createdAt: Date; engineer: { name: string } }[]).map((v) => ({
    type: "SERVICE_VISIT",
    timestamp: v.createdAt,
    description: `Visit ${v.visitId} — ${v.status} • ${v.visitPurpose || "OTHER"} • ${v.engineer?.name || ""}`,
    data: v,
  }));

  const partEvents = (partRequests as unknown as { requestId: string; status: string; quantity: number; createdAt: Date }[]).map((p) => ({
    type: "PART_REQUEST",
    timestamp: p.createdAt,
    description: `Part request ${p.requestId} — ${p.status} • qty ${p.quantity}`,
    data: p,
  }));

  const merged = [...auditEvents, ...visitEvents, ...partEvents, ...statusHistory, ...assignmentHistory].sort(
    (a, b) => new Date(a.timestamp as unknown as string).getTime() - new Date(b.timestamp as unknown as string).getTime()
  );

  return NextResponse.json({ callId: sc.callId, audits, visits, partRequests, statusHistory: sc.statusHistory, assignmentHistory: sc.assignmentHistory, timeline: merged });
}
