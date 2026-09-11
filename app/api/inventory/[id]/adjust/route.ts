import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { Inventory } from "@/models/Inventory";
import { StockMovement } from "@/models/StockMovement";
import { inventoryAdjustSchema } from "@/lib/validators";
import { genMovementId } from "@/lib/id-generators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = inventoryAdjustSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const { id } = await params;
  const inv = await Inventory.findById(id);
  if (!inv) return NextResponse.json({ error: "Inventory not found" }, { status: 404 });

  const { type, quantity, remarks } = parsed.data;
  if (type === "IN" && !hasPermission(auth.role, "inventory.receive")) return NextResponse.json({ error: "Forbidden inventory.receive" }, { status: 403 });
  if (type === "OUT" && !hasPermission(auth.role, "inventory.issue")) return NextResponse.json({ error: "Forbidden inventory.issue" }, { status: 403 });
  if (type === "ADJUSTMENT" && !hasPermission(auth.role, "inventory.adjust")) return NextResponse.json({ error: "Forbidden inventory.adjust" }, { status: 403 });
  if (type === "RETURN" && !hasPermission(auth.role, "inventory.receive")) return NextResponse.json({ error: "Forbidden inventory.receive" }, { status: 403 });

  let update: Record<string, unknown> | null = null;
  let movementType: string = type;
  if (type === "IN" || type === "RETURN" || type === "ADJUSTMENT") {
    update = { $inc: { quantityOnHand: quantity } };
    movementType = type === "ADJUSTMENT" ? "ADJUSTMENT" : "IN";
    if (type === "RETURN") movementType = "RETURN";
  } else if (type === "OUT") {
    const available = inv.quantityOnHand - inv.quantityReserved;
    if (available < quantity) return NextResponse.json({ error: `Insufficient stock. Available ${available}` }, { status: 400 });
    const res = await Inventory.findOneAndUpdate(
      { _id: id, $expr: { $gte: [{ $subtract: ["$quantityOnHand", "$quantityReserved"] }, quantity] } },
      { $inc: { quantityOnHand: -quantity } },
      { new: true }
    );
    if (!res) return NextResponse.json({ error: "Insufficient stock (race)" }, { status: 400 });
    const movementId = await genMovementId();
    await StockMovement.create({ movementId, part: inv.part, inventory: inv._id, movementType: "OUT", quantity, referenceType: "INVENTORY", referenceId: String(inv._id), performedBy: auth.sub, remarks });
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "UPDATE",
      module: "INVENTORY",
      recordId: String(inv._id),
      recordType: "Inventory",
      description: `Inventory OUT ${quantity} for part ${inv.part}`,
      after: { type, quantity, movementId } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    return NextResponse.json(res);
  }

  if (update) {
    const updated = await Inventory.findByIdAndUpdate(id, update, { new: true });
    const movementId = await genMovementId();
    await StockMovement.create({ movementId, part: inv.part, inventory: inv._id, movementType: movementType as never, quantity, referenceType: "INVENTORY", referenceId: String(inv._id), performedBy: auth.sub, remarks });
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "UPDATE",
      module: "INVENTORY",
      recordId: String(inv._id),
      recordType: "Inventory",
      description: `Inventory ${movementType} ${quantity} for part ${inv.part}`,
      after: { type: movementType, quantity, movementId } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
