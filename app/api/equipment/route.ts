import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { Equipment } from "@/models/Equipment";
import { equipmentSchema } from "@/lib/validators";
import { genEquipmentId, genQrToken } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const customer = searchParams.get("customer");
  const site = searchParams.get("site");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (customer) filter.customer = customer;
  if (site) filter.site = site;
  if (status) filter.equipmentStatus = status;
  if (q) filter.$or = [{ equipmentId: { $regex: q, $options: "i" } }, { assetId: { $regex: q, $options: "i" } }, { serialNumber: { $regex: q, $options: "i" } }, { make: { $regex: q, $options: "i" } }, { model: { $regex: q, $options: "i" } }];
  const [items, total] = await Promise.all([
    Equipment.find(filter).populate("customer", "companyName customerId").populate("site", "siteName siteId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Equipment.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = equipmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const equipmentId = await genEquipmentId();
  const qrToken = genQrToken();
  const doc = await Equipment.create({
    ...parsed.data,
    equipmentId,
    qrToken,
    installationDate: parsed.data.installationDate ? new Date(parsed.data.installationDate) : undefined,
    batteryInstallationDate: parsed.data.batteryInstallationDate ? new Date(parsed.data.batteryInstallationDate) : undefined,
    warrantyStartDate: parsed.data.warrantyStartDate ? new Date(parsed.data.warrantyStartDate) : undefined,
    warrantyEndDate: parsed.data.warrantyEndDate ? new Date(parsed.data.warrantyEndDate) : undefined,
    amcStartDate: parsed.data.amcStartDate ? new Date(parsed.data.amcStartDate) : undefined,
    amcEndDate: parsed.data.amcEndDate ? new Date(parsed.data.amcEndDate) : undefined,
    batteryQuantity: parsed.data.batteryQuantity || undefined,
  });
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "EQUIPMENT",
    recordId: equipmentId,
    recordObjectId: String(doc._id),
    recordType: "Equipment",
    description: `Equipment ${equipmentId} created`,
    after: { equipmentId, site: parsed.data.site, customer: parsed.data.customer } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json(doc, { status: 201 });
}
