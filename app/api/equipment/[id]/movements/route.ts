import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { EquipmentMovement } from "@/models/EquipmentMovement";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const items = await EquipmentMovement.find({ equipment: id })
    .populate("fromSite", "siteName siteId")
    .populate("toSite", "siteName siteId")
    .populate("updatedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({ items });
}
