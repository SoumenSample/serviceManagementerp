import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { EngineerShift } from "@/models/EngineerShift";

export async function POST() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "engineer") return NextResponse.json({ error: "Only engineers can end shift" }, { status: 403 });
  await connectDB();
  const shift = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" });
  if (!shift) return NextResponse.json({ error: "No active shift" }, { status: 404 });
  shift.status = "ENDED";
  shift.endedAt = new Date();
  await shift.save();
  return NextResponse.json({ shift });
}
