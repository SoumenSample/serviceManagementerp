import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";
import { visitSchema } from "@/lib/validators";
import { genVisitId } from "@/lib/id-generators";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const filter: Record<string, unknown> = { serviceCall: id };
  if (auth.role === "engineer") filter.engineer = auth.sub;
  const items = await ServiceVisit.find(filter).populate("engineer", "name email").sort({ visitDate: -1 }).lean();
  return NextResponse.json({ items });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = visitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const sc = await ServiceCall.findById(id);
  if (!sc) return NextResponse.json({ error: "Service call not found" }, { status: 404 });

  // Engineer can only log visit if they are assigned OR creator is admin/coordinator
  // Allow creation by admin/coordinator for any engineer via body.engineer
  let targetEngineer = auth.sub as string;
  if (body.engineer) {
    // Only non-engineers can specify engineer
    if (auth.role === "engineer") return NextResponse.json({ error: "Engineers cannot assign other engineers" }, { status: 403 });
    const engUser = await (await import("@/models/User")).User.findById(body.engineer);
    if (!engUser || engUser.role !== "engineer" || !engUser.isActive) return NextResponse.json({ error: "Invalid engineer" }, { status: 400 });
    targetEngineer = body.engineer;
    // Auto-update ServiceCall assignment if different and caller is admin/coordinator/manager
    if (String(sc.assignedEngineer) !== String(targetEngineer)) {
      sc.assignedEngineer = targetEngineer as never;
      sc.assignmentHistory.push({ engineer: targetEngineer as never, assignedAt: new Date(), assignedBy: auth.sub as never, reason: "Visit assignment", visitId: "pending" });
      await sc.save();
    }
  } else if (auth.role === "engineer" && String(sc.assignedEngineer) !== String(auth.sub)) {
    return NextResponse.json({ error: "Not assigned to this call" }, { status: 403 });
  }

  // Duplicate active visit protection
  const activeVisit = await ServiceVisit.findOne({ serviceCall: id, status: "IN_PROGRESS" });
  if (activeVisit) return NextResponse.json({ error: "Active visit already exists for this service call" }, { status: 409 });

  const visitId = await genVisitId();

  // Folder security for any photos sent during creation (rare but validate if present)
  if (parsed.data.beforePhotos) {
    const allowedBefore = `ups-system/service-calls/${sc.callId}/${visitId}/before`;
    for (const p of parsed.data.beforePhotos) if (!p.publicId.startsWith(allowedBefore)) return NextResponse.json({ error: `Invalid before photo folder. Expected ${allowedBefore}` }, { status: 400 });
  }
  if (parsed.data.afterPhotos) {
    const allowedAfter = `ups-system/service-calls/${sc.callId}/${visitId}/after`;
    for (const p of parsed.data.afterPhotos) if (!p.publicId.startsWith(allowedAfter)) return NextResponse.json({ error: `Invalid after photo folder. Expected ${allowedAfter}` }, { status: 400 });
  }
  if (parsed.data.customerSignature && !parsed.data.customerSignature.publicId.startsWith(`ups-system/signatures/${sc.callId}`)) {
    return NextResponse.json({ error: "Invalid signature folder" }, { status: 400 });
  }

  const doc = await ServiceVisit.create({
    visitId,
    serviceCall: id,
    engineer: targetEngineer,
    visitDate: new Date(parsed.data.visitDate),
    visitTime: parsed.data.visitTime,
    visitPurpose: parsed.data.visitPurpose || "OTHER",
    status: "NOT_STARTED",
    // Do NOT store GPS on creation — only on start/complete
    problemFound: parsed.data.problemFound,
    diagnosis: parsed.data.diagnosis,
    workDone: parsed.data.workDone,
    equipmentCondition: parsed.data.equipmentCondition,
    partsUsed: parsed.data.partsUsed,
    partsRequired: parsed.data.partsRequired,
    beforePhotos: parsed.data.beforePhotos,
    afterPhotos: parsed.data.afterPhotos,
    customerSignature: parsed.data.customerSignature,
    signatureReason: parsed.data.signatureReason,
    engineerRemarks: parsed.data.engineerRemarks,
  });
  // Update visitId in history if we pushed pending
  if (sc.assignmentHistory.length && sc.assignmentHistory[sc.assignmentHistory.length - 1].visitId === "pending") {
    sc.assignmentHistory[sc.assignmentHistory.length - 1].visitId = visitId;
    await sc.save();
  }

  // DO NOT transition ServiceCall to ENGINEER_VISITED on creation — only on Start Visit

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "SERVICE_VISIT",
    recordId: visitId,
    recordObjectId: String(doc._id),
    recordType: "ServiceVisit",
    description: `Service visit ${visitId} created for service call ${sc.callId}`,
    after: { visitId, serviceCall: sc.callId } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json(doc, { status: 201 });
}
