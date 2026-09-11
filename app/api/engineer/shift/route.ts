import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { EngineerShift } from "@/models/EngineerShift";
import { genShiftId } from "@/lib/id-generators";

// GET current shift (active)
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "engineer") return NextResponse.json({ error: "Only engineers have shifts" }, { status: 403 });
  await connectDB();
  const active = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" }).lean();
  return NextResponse.json({ shift: active || null });
}

// POST start/resume shift — idempotent, creates if no active
export async function POST() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "engineer") return NextResponse.json({ error: "Only engineers can start shift" }, { status: 403 });
  await connectDB();
  let shift = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" });
  if (shift) return NextResponse.json({ shift, resumed: true });
  const shiftId = await genShiftId();
  shift = await EngineerShift.create({
    shiftId,
    engineer: auth.sub,
    startedAt: new Date(),
    status: "ACTIVE",
  });
  return NextResponse.json({ shift, resumed: false }, { status: 201 });
}
