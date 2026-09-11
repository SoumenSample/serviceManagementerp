import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { PartRequest } from "@/models/PartRequest";
import { Part } from "@/models/Part";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";
import { Equipment } from "@/models/Equipment";
import { partRequestSchema } from "@/lib/validators";
import { genPartRequestId } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "partRequest.view") && !hasPermission(auth.role, "parts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const part = searchParams.get("part");
  const serviceCall = searchParams.get("serviceCall");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (part) filter.part = part;
  if (serviceCall) filter.serviceCall = serviceCall;
  if (auth.role === "engineer") filter.requestedBy = auth.sub;
  const [items, total] = await Promise.all([
    PartRequest.find(filter).populate("part", "partId partNumber name").populate("serviceCall", "callId").populate("serviceVisit", "visitId").populate("requestedBy", "name").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PartRequest.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "partRequest.create") && !hasPermission(auth.role, "parts.request")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = partRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();

  const part = await Part.findById(parsed.data.part);
  if (!part || !part.active) return NextResponse.json({ error: "Part not found or inactive" }, { status: 400 });
  const sc = await ServiceCall.findById(parsed.data.serviceCall);
  if (!sc) return NextResponse.json({ error: "ServiceCall not found" }, { status: 400 });
  const sv = await ServiceVisit.findById(parsed.data.serviceVisit);
  if (!sv) return NextResponse.json({ error: "ServiceVisit not found" }, { status: 400 });
  if (String(sv.serviceCall) !== String(parsed.data.serviceCall)) return NextResponse.json({ error: "ServiceVisit does not belong to ServiceCall" }, { status: 400 });
  if (auth.role === "engineer" && String(sc.assignedEngineer) !== String(auth.sub)) return NextResponse.json({ error: "Not assigned to this call" }, { status: 403 });
  if (parsed.data.equipment) {
    const eq = await Equipment.findById(parsed.data.equipment);
    if (!eq) return NextResponse.json({ error: "Equipment not found" }, { status: 400 });
  }

  const requestId = await genPartRequestId();
  const doc = await PartRequest.create({
    requestId,
    part: parsed.data.part,
    quantity: parsed.data.quantity,
    serviceCall: parsed.data.serviceCall,
    serviceVisit: parsed.data.serviceVisit,
    equipment: parsed.data.equipment || undefined,
    requestedBy: auth.sub,
    requestedAt: new Date(),
    status: "REQUIRED",
    remarks: parsed.data.remarks,
  });
  // REQUIRED does NOT deduct stock — no inventory change
  // Notify PARTS_REQUIRED (in-app)
  try {
    const { notify } = await import("@/lib/notifications/notification-service");
    const { User } = await import("@/models/User");
    const staff = await User.find({ role: { $in: ["manager", "coordinator"] }, isActive: true }).select("_id").lean();
    for (const u of staff) notify({ eventType: "PARTS_REQUIRED", channel: "IN_APP", title: "Parts Required", message: `${requestId} requires ${parsed.data.quantity} units`, recipientUser: String(u._id), relatedModule: "PartRequest", relatedRecordId: String(doc._id), serviceCall: String(parsed.data.serviceCall), dedupKey: `PARTS_REQUIRED:${doc._id}:IN_APP:${u._id}` }).catch(() => {});
    if (sc.assignedEngineer) notify({ eventType: "PARTS_REQUIRED", channel: "IN_APP", title: "Parts Required", message: `${requestId} parts required`, recipientUser: String(sc.assignedEngineer), relatedModule: "PartRequest", relatedRecordId: String(doc._id), serviceCall: String(parsed.data.serviceCall), dedupKey: `PARTS_REQUIRED:${doc._id}:IN_APP:${sc.assignedEngineer}` }).catch(() => {});
  } catch {}
    createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "PART_REQUEST",
    recordId: (doc as any).requestId || String((doc as any)._id),
    recordObjectId: String((doc as any)._id),
    recordType: "PartRequest",
    description: `Part request ${(doc as any).requestId} created`,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(()=>{});
  return NextResponse.json(doc, { status: 201 });
}
