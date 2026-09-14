import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Attendance } from "@/models/Attendance";
import { EngineerShift } from "@/models/EngineerShift";
import { getISTDateString } from "@/lib/attendance-helpers";

export async function POST() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const now = new Date();
  const attendanceDate = getISTDateString(now);
  let attendance = await Attendance.findOne({ user: auth.sub, attendanceDate });
  if (!attendance) attendance = await Attendance.findOne({ user: auth.sub, status: "ACTIVE" });
  if (!attendance) {
    return NextResponse.json({ attendance: null, message: "No attendance for today" });
  }

  // Close current open session if any
  if (attendance.sessions && attendance.sessions.length > 0) {
    const lastIdx = attendance.sessions.length - 1;
    const last = attendance.sessions[lastIdx] as unknown as { logoutAt?: Date };
    if (!last.logoutAt) {
      (attendance.sessions[lastIdx] as unknown as { logoutAt?: Date }).logoutAt = now;
      attendance.markModified("sessions");
    }
  }
  attendance.status = "ENDED";
  attendance.endedAt = now;
  attendance.lastActivityAt = now;
  await attendance.save();

  // For engineer, also end EngineerShift and stop GPS
  if (auth.role === "engineer") {
    try {
      const shift = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" });
      if (shift) {
        shift.status = "ENDED";
        shift.endedAt = new Date();
        await shift.save();
      }
    } catch {}
  }

  return NextResponse.json({ attendance });
}
