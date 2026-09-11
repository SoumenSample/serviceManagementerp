import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { Equipment } from "@/models/Equipment";
import { equipmentSchema } from "@/lib/validators";
import { EquipmentMovement } from "@/models/EquipmentMovement";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await Equipment.findById(id).populate("customer", "companyName customerId").populate("site", "siteName siteId").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { site: newSite, remarks: moveRemarks, reason, ...rest } = body;
  const parsed = equipmentSchema.partial().safeParse(rest);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const existing = await Equipment.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fromSiteId = String(existing.site);
  let isTransfer = false;
  // Handle site transfer - keep equipmentId immutable, record movement
  if (newSite && String(existing.site) !== String(newSite)) {
    await EquipmentMovement.create({ equipment: existing._id, fromSite: existing.site, toSite: newSite, reason: reason || "Transfer", updatedBy: auth.sub, remarks: moveRemarks });
    existing.site = newSite;
    existing.equipmentStatus = "TRANSFERRED";
    isTransfer = true;
  }
  Object.assign(existing, parsed.data);
  if (parsed.data.installationDate) existing.installationDate = new Date(parsed.data.installationDate);
  if (parsed.data.warrantyStartDate) existing.warrantyStartDate = new Date(parsed.data.warrantyStartDate);
  if (parsed.data.warrantyEndDate) existing.warrantyEndDate = new Date(parsed.data.warrantyEndDate);
  if (parsed.data.amcStartDate) existing.amcStartDate = new Date(parsed.data.amcStartDate);
  if (parsed.data.amcEndDate) existing.amcEndDate = new Date(parsed.data.amcEndDate);
  const beforeEq = { site: fromSiteId, equipmentStatus: existing.equipmentStatus };
  await existing.save();
  if (isTransfer) {
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "TRANSFER",
      module: "EQUIPMENT",
      recordId: existing.equipmentId,
      recordObjectId: String(existing._id),
      recordType: "Equipment",
      description: `Equipment ${existing.equipmentId} transferred from ${fromSiteId} to ${newSite}`,
      before: beforeEq as unknown as Record<string, unknown>,
      after: { site: String(existing.site), equipmentStatus: existing.equipmentStatus } as unknown as Record<string, unknown>,
      metadata: { ...extractRequestMeta(req), reason } as Record<string, unknown>,
    }).catch(() => {});
  } else {
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "UPDATE",
      module: "EQUIPMENT",
      recordId: existing.equipmentId,
      recordObjectId: String(existing._id),
      recordType: "Equipment",
      description: `Equipment ${existing.equipmentId} updated`,
      after: parsed.data as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
  }
  return NextResponse.json(existing);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await Equipment.findByIdAndDelete(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
