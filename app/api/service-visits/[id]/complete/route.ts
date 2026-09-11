import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { ServiceVisit } from "@/models/ServiceVisit";
import { ServiceCall } from "@/models/ServiceCall";
import { visitCompleteSchema } from "@/lib/validators";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = visitCompleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();

  const visit = await ServiceVisit.findById(id);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const sc = await ServiceCall.findById(visit.serviceCall);
  if (!sc) return NextResponse.json({ error: "ServiceCall not found" }, { status: 404 });

  if (auth.role === "engineer" && String(sc.assignedEngineer) !== String(auth.sub) && String(visit.engineer) !== String(auth.sub)) {
    return NextResponse.json({ error: "Not assigned" }, { status: 403 });
  }
  if (visit.status !== "IN_PROGRESS") return NextResponse.json({ error: `Cannot complete visit with status ${visit.status}` }, { status: 400 });

  // Cloudinary folder security: derive allowed folders from DB, reject forged publicIds
  const allowedBeforePrefix = `ups-system/service-calls/${sc.callId}/${visit.visitId}/before`;
  const allowedAfterPrefix = `ups-system/service-calls/${sc.callId}/${visit.visitId}/after`;
  const allowedSigPrefix = `ups-system/signatures/${sc.callId}`;
  if (parsed.data.beforePhotos) {
    for (const p of parsed.data.beforePhotos) {
      if (!p.publicId.startsWith(allowedBeforePrefix)) return NextResponse.json({ error: `Invalid before photo folder. Expected prefix ${allowedBeforePrefix}` }, { status: 400 });
      if (p.publicId.includes("..")) return NextResponse.json({ error: "Invalid publicId" }, { status: 400 });
    }
  }
  if (parsed.data.afterPhotos) {
    for (const p of parsed.data.afterPhotos) {
      if (!p.publicId.startsWith(allowedAfterPrefix)) return NextResponse.json({ error: `Invalid after photo folder. Expected prefix ${allowedAfterPrefix}` }, { status: 400 });
      if (p.publicId.includes("..")) return NextResponse.json({ error: "Invalid publicId" }, { status: 400 });
    }
  }
  if (parsed.data.customerSignature && !parsed.data.customerSignature.publicId.startsWith(allowedSigPrefix)) {
    return NextResponse.json({ error: `Invalid signature folder. Expected prefix ${allowedSigPrefix}` }, { status: 400 });
  }

  // Protect immutable fields: do not allow overwriting startedAt etc via normal update
  visit.completionLatitude = parsed.data.completionLatitude;
  visit.completionLongitude = parsed.data.completionLongitude;
  visit.completionGpsAccuracy = parsed.data.completionGpsAccuracy;
  visit.completionTimestamp = parsed.data.completionTimestamp ? new Date(parsed.data.completionTimestamp) : (parsed.data.completionLatitude ? new Date() : undefined);
  visit.completedAt = new Date(); // server time authoritative
  visit.status = "COMPLETED";

  // Update visit details if provided and not yet finalized
  if (parsed.data.diagnosis) visit.diagnosis = parsed.data.diagnosis;
  if (parsed.data.workDone) visit.workDone = parsed.data.workDone;
  if (parsed.data.problemFound) visit.problemFound = parsed.data.problemFound;
  if (parsed.data.equipmentCondition) visit.equipmentCondition = parsed.data.equipmentCondition;
  if (parsed.data.engineerRemarks) visit.engineerRemarks = parsed.data.engineerRemarks;
  if (parsed.data.beforePhotos) visit.beforePhotos = parsed.data.beforePhotos as never;
  if (parsed.data.afterPhotos) visit.afterPhotos = parsed.data.afterPhotos as never;
  if (parsed.data.customerSignature) visit.customerSignature = parsed.data.customerSignature as never;
  if (parsed.data.signatureReason) visit.signatureReason = parsed.data.signatureReason;

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
    description: `Visit ${visit.visitId} completed`,
    after: { status: "COMPLETED" } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(()=>{});

  // Do NOT auto-close ServiceCall — only set completedAt on visit
  // ServiceCall actualResolutionDate only on CLOSED, not on visit complete

  return NextResponse.json(visit);
}
