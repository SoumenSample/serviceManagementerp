import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { ROLES } from "@/lib/rbac";
import { signJWT } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth-server";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES).optional(),
  mobile: z.string().optional(),
  employeeId: z.string().optional(),
  designation: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    await connectDB();
    const exists = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

    // First user becomes super_admin automatically
    const count = await User.countDocuments();
    const role = count === 0 ? "super_admin" : (parsed.data.role || "engineer");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role,
      mobile: parsed.data.mobile,
      employeeId: parsed.data.employeeId,
      designation: parsed.data.designation,
    });

    const token = await signJWT({ sub: String(user._id), email: user.email, role: user.role as never, name: user.name });
    const res = NextResponse.json({ ok: true, user: { id: String(user._id), name: user.name, email: user.email, role: user.role } }, { status: 201 });
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
