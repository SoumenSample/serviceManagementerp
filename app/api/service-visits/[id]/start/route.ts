import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { ServiceVisit } from "@/models/ServiceVisit";
import { ServiceCall } from "@/models/ServiceCall";
import { visitStartSchema } from "@/lib/validators";
import { isValidTransition, getNextAction } from "@/lib/servicecall-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = visitStartSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();

  const visit = await ServiceVisit.findById(id);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const sc = await ServiceCall.findById(visit.serviceCall);
  if (!sc) return NextResponse.json({ error: "ServiceCall not found" }, { status: 404 });

  // Ownership: engineer must be assigned
  if (auth.role === "engineer" && String(sc.assignedEngineer) !== String(auth.sub) && String(visit.engineer) !== String(auth.sub)) {
    return NextResponse.json({ error: "Not assigned to this call" }, { status: 403 });
  }
  // Trust server auth, not body engineerId
  if (visit.status !== "NOT_STARTED") return NextResponse.json({ error: `Cannot start visit with status ${visit.status}` }, { status: 400 });

  // Duplicate active visit protection (server-side)
  const active = await ServiceVisit.findOne({ serviceCall: visit.serviceCall, status: "IN_PROGRESS", _id: { $ne: visit._id } });
  if (active) return NextResponse.json({ error: "Another active visit exists for this call" }, { status: 409 });

  // GPS validation already via Zod ranges
  visit.gpsLatitude = parsed.data.gpsLatitude;
  visit.gpsLongitude = parsed.data.gpsLongitude;
  visit.gpsAccuracy = parsed.data.gpsAccuracy;
  visit.gpsTimestamp = parsed.data.gpsTimestamp ? new Date(parsed.data.gpsTimestamp) : new Date();
  visit.startedAt = new Date(); // server time
  visit.status = "IN_PROGRESS";
  await visit.save();
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "UPDATE",
    module: "SERVICE_VISIT",
    recordId: visit.visitId,
    recordObjectId: String(visit._id),
    recordType: "ServiceVisit",
    description: `Visit ${visit.visitId} started`,
    after: { status: "IN_PROGRESS" } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(()=>{});

  // Update ServiceCall using existing engine if VISIT_SCHEDULED → ENGINEER_VISITED
  if (sc.currentStatus === "VISIT_SCHEDULED" && isValidTransition(sc.currentStatus as never, "ENGINEER_VISITED" as never)) {
    sc.currentStatus = "ENGINEER_VISITED";
    if (!sc.actualVisitDate) sc.actualVisitDate = new Date();
    sc.statusHistory.push({ status: "ENGINEER_VISITED", date: new Date(), updatedBy: auth.sub as never, remarks: `Visit ${visit.visitId} started` });
    sc.nextAction = getNextAction("ENGINEER_VISITED");
    await sc.save();
  }

  return NextResponse.json(visit);
}
