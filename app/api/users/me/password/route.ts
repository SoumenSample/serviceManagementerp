import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { User } from "@/models/User";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const user = await User.findById(auth.sub).select("+passwordHash");
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password incorrect" }, { status: 400 });
  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await user.save();
  return NextResponse.json({ ok: true });
}
