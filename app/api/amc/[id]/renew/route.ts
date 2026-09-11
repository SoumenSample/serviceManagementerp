import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { AmcContract } from "@/models/AmcContract";
import { amcRenewSchema } from "@/lib/validators";
import { genAmcId } from "@/lib/id-generators";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.create") && !hasPermission(auth.role, "amc.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = amcRenewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const old = await AmcContract.findById(id);
  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (old.status === "CANCELLED") return NextResponse.json({ error: "Cannot renew cancelled AMC" }, { status: 400 });

  const newAmcId = await genAmcId();
  const newDoc = await AmcContract.create({
    amcId: newAmcId,
    customer: old.customer,
    site: old.site,
    equipmentIds: old.equipmentIds,
    amcType: parsed.data.newAmcType || old.amcType,
    startDate: new Date(parsed.data.newStartDate),
    endDate: new Date(parsed.data.newEndDate),
    contractAmount: parsed.data.contractAmount ?? old.contractAmount,
    paymentStatus: parsed.data.paymentStatus || "NOT_BILLED",
    assignedEngineer: parsed.data.assignedEngineer || old.assignedEngineer,
    terms: parsed.data.terms || old.terms,
    status: "ACTIVE",
    documents: [],
    renewalHistory: [],
    createdBy: auth.sub,
    updatedBy: auth.sub,
  });

  // Update old AMC to RENEWED and push history
  old.status = "RENEWED";
  old.renewalHistory.push({
    previousAmcId: old.amcId,
    newAmcId: newDoc.amcId,
    renewalDate: new Date(),
    renewedBy: auth.sub as never,
    previousEndDate: old.endDate,
    newStartDate: newDoc.startDate,
    newEndDate: newDoc.endDate,
    remarks: parsed.data.remarks,
  });
  await old.save();

  // Also push reciprocal history to new doc for traceability
  newDoc.renewalHistory.push({
    previousAmcId: old.amcId,
    newAmcId: newDoc.amcId,
    renewalDate: new Date(),
    renewedBy: auth.sub as never,
    previousEndDate: old.endDate,
    newStartDate: newDoc.startDate,
    newEndDate: newDoc.endDate,
    remarks: parsed.data.remarks,
  });
  await newDoc.save();

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "RENEW",
    module: "AMC",
    recordId: newAmcId,
    recordObjectId: String(newDoc._id),
    recordType: "AmcContract",
    description: `AMC ${old.amcId} renewed to ${newAmcId}`,
    before: { amcId: old.amcId, endDate: old.endDate } as unknown as Record<string, unknown>,
    after: { newAmcId, newStartDate: newDoc.startDate, newEndDate: newDoc.endDate } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json({ oldAmc: old, newAmc: newDoc }, { status: 201 });
}
