import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { EngineerShift } from "@/models/EngineerShift";

// Admin/Manager/Coordinator requests live location — sets flag that engineer PWA polls
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = hasPermission(auth.role, "users.view") || hasPermission(auth.role, "users.manage") || ["super_admin","manager","coordinator"].includes(auth.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const shift = await EngineerShift.findOne({ engineer: id, status: "ACTIVE" });
  if (!shift) return NextResponse.json({ error: "Engineer has no active shift", offline: true }, { status: 404 });
  shift.locationRefreshRequestedAt = new Date();
  await shift.save();
  return NextResponse.json({ ok: true, requestedAt: shift.locationRefreshRequestedAt, shiftId: shift.shiftId });
}
