import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";

const MANAGERIAL_ROLES = ["super_admin", "manager", "coordinator", "accounts"];

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MANAGERIAL_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden: only management can view all attendance" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const employee = searchParams.get("employee");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (employee) filter.user = employee;
  if (from || to) {
    const range: Record<string, string> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.attendanceDate = range;
  }

  if (q) {
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { employeeId: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const ids = users.map((u) => u._id);
    // also search by attendanceId or attendanceDate
    filter.$or = [{ user: { $in: ids } }, { attendanceId: { $regex: q, $options: "i" } }, { attendanceDate: { $regex: q, $options: "i" } }];
  }

  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .populate("user", "name email employeeId role")
      .sort({ attendanceDate: -1, startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}
