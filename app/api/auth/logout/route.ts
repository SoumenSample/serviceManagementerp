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
    // End active engineer shift on logout
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
