import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { User } from "@/models/User";
import { EngineerShift } from "@/models/EngineerShift";
import { ServiceCall } from "@/models/ServiceCall";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only management can view all engineers' locations
  const allowed = hasPermission(auth.role, "users.view") || hasPermission(auth.role, "users.manage") || ["super_admin","manager","coordinator"].includes(auth.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  // Lazy cleanup: auto-close previous-day ACTIVE GPS shifts (browser closed without
  // logout) so engineers who haven't logged in today don't show a green Active badge
  try {
    const { closeStaleEngineerShifts } = await import("@/lib/attendance-server");
    await closeStaleEngineerShifts();
  } catch {}
  const engineers = await User.find({ role: "engineer", isActive: true }).select("name email employeeId").lean();
  const results = await Promise.all(
    engineers.map(async (eng) => {
      let shift = await EngineerShift.findOne({ engineer: eng._id, status: "ACTIVE" }).lean() as unknown as { shiftId: string; status: string; startedAt: Date; endedAt?: Date; lastLocationAt?: Date; lastLatitude?: number; lastLongitude?: number; lastAddress?: string; lastAccuracy?: number } | null;
      if (!shift) shift = await EngineerShift.findOne({ engineer: eng._id }).sort({ startedAt: -1 }).lean() as unknown as { shiftId: string; status: string; startedAt: Date; endedAt?: Date; lastLocationAt?: Date; lastLatitude?: number; lastLongitude?: number; lastAddress?: string; lastAccuracy?: number } | null;
      // Current assigned service call (latest active)
      const currentCall = await ServiceCall.findOne({ assignedEngineer: eng._id, currentStatus: { $nin: ["CLOSED","CANCELLED"] } })
        .select("callId currentStatus site")
        .populate("site", "siteName")
        .sort({ updatedAt: -1 })
        .lean() as unknown as { callId: string; currentStatus: string; site?: { siteName: string } } | null;
      const isStale = shift?.lastLocationAt ? Date.now() - new Date(shift.lastLocationAt).getTime() : null;
      let freshness: "live"|"stale"|"offline" = "offline";
      if (isStale !== null) {
        if (isStale < 2 * 60 * 1000) freshness = "live";
        else if (isStale < 15 * 60 * 1000) freshness = "stale";
        else freshness = "offline";
      }
      return {
        engineer: eng,
        shift,
        currentCall,
        freshness,
        isActive: shift?.status === "ACTIVE",
      };
    })
  );
  return NextResponse.json({ items: results });
}
