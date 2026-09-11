import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { Part } from "@/models/Part";
import { Inventory } from "@/models/Inventory";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { partSchema } from "@/lib/validators";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "parts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; await connectDB();
  const doc = await Part.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "parts.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = partSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  if (parsed.data.partNumber) {
    const dup = await Part.findOne({ partNumber: parsed.data.partNumber, _id: { $ne: id } });
    if (dup) return NextResponse.json({ error: "SKU exists" }, { status: 409 });
  }
  const { initialStock: _omit, ...updateData } = parsed.data as typeof parsed.data & { initialStock?: number };
  const doc = await Part.findByIdAndUpdate(id, { ...updateData, updatedBy: auth.sub }, { new: true });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "parts.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; await connectDB();
  const doc = await Part.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await Part.findByIdAndDelete(id);
  // Clean up related inventory (hard delete)
  await Inventory.deleteMany({ part: id });
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "DELETE",
    module: "PART",
    recordId: doc.partNumber,
    recordObjectId: String(doc._id),
    recordType: "Part",
    description: `Part ${doc.partNumber} deleted`,
    before: { partNumber: doc.partNumber, name: doc.name } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
