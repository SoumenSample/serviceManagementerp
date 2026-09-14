import { NextResponse } from "next/server";
import { AUTH_COOKIE, getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

export async function POST(req: Request) {
  const auth = await getAuth().catch(() => null);
  if (auth) {
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "LOGOUT",
      module: "AUTH",
      recordId: auth.email,
      recordType: "User",
      description: `User ${auth.email} logged out`,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    // Close today's attendance session (daily workday, not per-login)
    try {
      const { connectDB } = await import("@/lib/db");
      await connectDB();
      const { Attendance } = await import("@/models/Attendance");
      const { getISTDateString } = await import("@/lib/attendance-helpers");
      const now = new Date();
      const attendanceDate = getISTDateString(now);
      let att = await Attendance.findOne({ user: auth.sub, attendanceDate });
      // fallback for old records without attendanceDate
      if (!att) att = await Attendance.findOne({ user: auth.sub, status: "ACTIVE" });
      if (att && att.sessions && att.sessions.length > 0) {
        const lastIdx = att.sessions.length - 1;
        const last = att.sessions[lastIdx] as unknown as { loginAt: Date; logoutAt?: Date };
        if (!last.logoutAt) {
          (att.sessions[lastIdx] as unknown as { logoutAt?: Date }).logoutAt = now;
          att.markModified("sessions");
          att.lastActivityAt = now;
          att.status = "ENDED";
          att.endedAt = now;
          await att.save();
        } else {
          // No open session, just update activity and ensure ENDED
          if (att.status === "ACTIVE") {
            att.status = "ENDED";
            att.endedAt = now;
            att.lastActivityAt = now;
            await att.save();
          }
        }
      } else if (att) {
        // No sessions array (old record), fallback to old behavior
        if (att.status === "ACTIVE") {
          att.status = "ENDED";
          att.endedAt = now;
          att.lastActivityAt = now;
          await att.save();
        }
      }
    } catch {}
    // End active engineer shift on logout (preserve existing GPS behavior)
    if (auth.role === "engineer") {
      try {
        const { connectDB } = await import("@/lib/db");
        await connectDB();
        const { EngineerShift } = await import("@/models/EngineerShift");
        const active = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" });
        if (active) {
          active.status = "ENDED";
          active.endedAt = new Date();
          await active.save();
        }
      } catch {}
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
