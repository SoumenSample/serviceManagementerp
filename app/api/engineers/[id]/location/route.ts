import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { User } from "@/models/User";
import { EngineerShift } from "@/models/EngineerShift";
import { EngineerLocation } from "@/models/EngineerLocation";
import { ServiceCall } from "@/models/ServiceCall";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = hasPermission(auth.role, "users.view") || hasPermission(auth.role, "users.manage") || ["super_admin","manager","coordinator"].includes(auth.role);
  // Engineers can only view own
  const { id } = await params;
  if (auth.role === "engineer" && String(auth.sub) !== String(id)) return NextResponse.json({ error: "Forbidden: engineers can only view own location" }, { status: 403 });
  if (!allowed && auth.role !== "engineer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  try {
    const { closeStaleEngineerShiftsForEngineer } = await import("@/lib/attendance-server");
    await closeStaleEngineerShiftsForEngineer(id);
  } catch {}
  const eng = await User.findById(id).select("name email employeeId role").lean();
  if (!eng || eng.role !== "engineer") return NextResponse.json({ error: "Engineer not found" }, { status: 404 });
  const shift = await EngineerShift.findOne({ engineer: id }).sort({ startedAt: -1 }).lean() as unknown as { _id: unknown; shiftId: string; status: string; startedAt: Date; endedAt?: Date; lastLocationAt?: Date; lastLatitude?: number; lastLongitude?: number; lastAddress?: string; lastAccuracy?: number } | null;
  const latest = shift ? await (EngineerLocation as unknown as { findOne: (f: Record<string, unknown>) => { sort: (s: Record<string, unknown>) => { lean: () => Promise<unknown> } } }).findOne({ engineer: id, shift: (shift as unknown as { _id: unknown })._id }).sort({ capturedAt: -1 }).lean() as unknown as { latitude: number; longitude: number } | null : null;
  const history = shift ? await (EngineerLocation as unknown as { find: (f: Record<string, unknown>) => { sort: (s: Record<string, unknown>) => { limit: (n: number) => { lean: () => Promise<unknown> } } } }).find({ engineer: id, shift: (shift as unknown as { _id: unknown })._id }).sort({ capturedAt: -1 }).limit(20).lean() as unknown as unknown[] : [];
  const currentCall = await ServiceCall.findOne({ assignedEngineer: id, currentStatus: { $nin: ["CLOSED","CANCELLED"] } })
    .populate("site", "siteName")
    .populate("customer", "companyName")
    .lean() as unknown as { callId: string; currentStatus: string; site?: { siteName: string }; customer?: { companyName: string } } | null;
  return NextResponse.json({ engineer: eng, shift, latest, history, currentCall });
}
