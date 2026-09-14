import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Attendance } from "@/models/Attendance";

const MANAGERIAL_ROLES = ["super_admin", "manager", "coordinator", "accounts"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const attendance = await Attendance.findOne({ attendanceId: id }).populate("user", "name email employeeId role").lean();
  if (!attendance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const populatedUser = attendance.user as unknown as { _id: { toString(): string } | string; toString?: () => string } | string;
  let actualUserId: string;
  if (typeof populatedUser === "string") actualUserId = populatedUser;
  else if (populatedUser && typeof populatedUser === "object" && "_id" in populatedUser) actualUserId = String((populatedUser as { _id: unknown })._id);
  else actualUserId = String(populatedUser);

  if (MANAGERIAL_ROLES.includes(auth.role)) {
    // management can view any
    return NextResponse.json({ attendance });
  }
  // engineer and other roles can only view own
  if (actualUserId !== auth.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ attendance });
}
