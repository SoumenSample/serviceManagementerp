import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Attendance } from "@/models/Attendance";
import { genAttendanceId } from "@/lib/id-generators";
import { getISTDateString } from "@/lib/attendance-helpers";

// GET current attendance for authenticated user (today's daily record)
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const attendanceDate = getISTDateString(new Date());
  const today = await Attendance.findOne({ user: auth.sub, attendanceDate }).lean();
  if (today) {
    return NextResponse.json({ attendance: today, latest: today });
  }
  // No today record - check for any ACTIVE (old session-based fallback)
  const active = await Attendance.findOne({ user: auth.sub, status: "ACTIVE" }).lean();
  if (active) return NextResponse.json({ attendance: active });
  const latest = await Attendance.findOne({ user: auth.sub }).sort({ attendanceDate: -1, startedAt: -1 }).lean();
  return NextResponse.json({ attendance: null, latest: latest || null });
}

// POST start/resume attendance - daily; creates new session if needed
export async function POST() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const now = new Date();
  const attendanceDate = getISTDateString(now);

  let att = await Attendance.findOne({ user: auth.sub, attendanceDate });
  if (att) {
    const last = att.sessions && att.sessions.length > 0 ? att.sessions[att.sessions.length - 1] as unknown as { logoutAt?: Date } : null;
    const hasOpen = last && !last.logoutAt;
    if (hasOpen) return NextResponse.json({ attendance: att, resumed: true });
    // reopen today's record with new session
    att.sessions.push({ loginAt: now } as never);
    att.status = "ACTIVE";
    att.endedAt = undefined;
    att.lastActivityAt = now;
    await att.save();
    return NextResponse.json({ attendance: att, resumed: false });
  }

  // No today record - try create (race-safe)
  try {
    const attendanceId = await genAttendanceId();
    att = await Attendance.create({
      attendanceId,
      user: auth.sub,
      role: auth.role,
      attendanceDate,
      startedAt: now,
      status: "ACTIVE",
      lastActivityAt: now,
      sessions: [{ loginAt: now }],
    });
    return NextResponse.json({ attendance: att, resumed: false }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate") || msg.includes("E11000")) {
      att = await Attendance.findOne({ user: auth.sub, attendanceDate });
      if (att) {
        const last = att.sessions && att.sessions.length > 0 ? att.sessions[att.sessions.length - 1] as unknown as { logoutAt?: Date } : null;
        if (last && !last.logoutAt) return NextResponse.json({ attendance: att, resumed: true });
        att.sessions.push({ loginAt: now } as never);
        att.status = "ACTIVE";
        att.endedAt = undefined;
        att.lastActivityAt = now;
        await att.save();
        return NextResponse.json({ attendance: att, resumed: false });
      }
    }
    throw e;
  }
}
