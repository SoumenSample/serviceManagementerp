import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signJWT } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("+passwordHash");
    if (!user || !user.isActive) {
      createAuditLog({
        action: "LOGIN_FAILURE",
        module: "AUTH",
        recordId: parsed.data.email.toLowerCase(),
        recordType: "User",
        description: `Login failed for ${parsed.data.email.toLowerCase()} — user not found or inactive`,
        metadata: { ...extractRequestMeta(req), email: parsed.data.email.toLowerCase() } as Record<string, unknown>,
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      createAuditLog({
        action: "LOGIN_FAILURE",
        module: "AUTH",
        recordId: user.email,
        recordType: "User",
        description: `Login failed for ${user.email} — invalid password`,
        metadata: { ...extractRequestMeta(req), email: user.email } as Record<string, unknown>,
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signJWT({ sub: String(user._id), email: user.email, role: user.role as never, name: user.name });
    createAuditLog({
      actorId: String(user._id),
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      module: "AUTH",
      recordId: user.email,
      recordType: "User",
      description: `User ${user.email} logged in`,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    const res = NextResponse.json({ ok: true, user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
