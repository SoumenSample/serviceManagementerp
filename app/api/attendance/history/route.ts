import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Attendance } from "@/models/Attendance";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;

  await connectDB();
  try {
    const { closeStaleAttendancesForUser } = await import("@/lib/attendance-server");
    await closeStaleAttendancesForUser(auth.sub);
  } catch {}
  const filter: Record<string, unknown> = { user: auth.sub };
  const status = searchParams.get("status");
  if (status) filter.status = status;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    // attendanceDate is YYYY-MM-DD IST string - lexicographic range works
    const range: Record<string, string> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.attendanceDate = range;
  }

  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ attendanceDate: -1, startedAt: -1 }).skip(skip).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}
