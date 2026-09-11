import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { Part } from "@/models/Part";
import { Inventory } from "@/models/Inventory";
import { partSchema } from "@/lib/validators";
import { genPartId } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "parts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const active = searchParams.get("active");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (active) filter.active = active === "true";
  if (q) filter.$or = [{ partNumber: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }, { partId: { $regex: q, $options: "i" } }];
  const [items, total] = await Promise.all([Part.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Part.countDocuments(filter)]);
  // Attach inventory availability for low-stock indicator
  const partIds = items.map((p) => p._id);
  const invs = await Inventory.find({ part: { $in: partIds } }).lean();
  const invMap = new Map(invs.map((i) => [String(i.part), i]));
  const enriched = items.map((p) => {
    const inv = invMap.get(String(p._id)) as unknown as { quantityOnHand: number; quantityReserved: number } | undefined;
    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
    return { ...p, inventory: inv, available };
  });
  return NextResponse.json({ items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "parts.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = partSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const exists = await Part.findOne({ partNumber: parsed.data.partNumber.toUpperCase() });
  if (exists) return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
  const partId = await genPartId();
  const { initialStock, ...partData } = parsed.data as typeof parsed.data & { initialStock?: number };
  const doc = await Part.create({ ...partData, partId, createdBy: auth.sub, updatedBy: auth.sub });
  // Create inventory record for default location with initial stock
  const qty = Math.max(0, Number(initialStock || 0));
  await Inventory.create({ part: doc._id, location: "MAIN", quantityOnHand: qty, quantityReserved: 0 });
  if (qty > 0) {
    const { StockMovement } = await import("@/models/StockMovement");
    const { genMovementId } = await import("@/lib/id-generators");
    const movementId = await genMovementId();
    await StockMovement.create({ movementId, part: doc._id, inventory: (await Inventory.findOne({ part: doc._id }))?._id, movementType: "IN", quantity: qty, referenceType: "PART_CREATE", referenceId: partId, performedBy: auth.sub, remarks: "Initial stock on creation" });
  }
    createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "PART",
    recordId: (doc as any).partNumber || String((doc as any)._id),
    recordObjectId: String((doc as any)._id),
    recordType: "Part",
    description: `Part ${(doc as any).partNumber} created`,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(()=>{});
return NextResponse.json(doc, { status: 201 });
}
