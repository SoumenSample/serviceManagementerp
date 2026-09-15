import { connectDB } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { getISTDateString } from "@/lib/attendance-helpers";

/** End of IST day as UTC Date: YYYY-MM-DD 23:59:59.999 +05:30 */
export function getISTDayEndUTC(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/** Close a single attendance doc's open sessions at given closeTime */
async function closeDoc(attendanceId: unknown, closeTime: Date) {
  const att = await Attendance.findById(attendanceId);
  if (!att || att.status !== "ACTIVE") return;
  const sessions = (att.sessions || []).map((s: unknown) => {
    const sess = s as { loginAt: Date; logoutAt?: Date };
    if (!sess.logoutAt) return { loginAt: sess.loginAt, logoutAt: closeTime };
    return sess;
  });
  await Attendance.updateOne(
    { _id: att._id },
    { $set: { sessions, status: "ENDED", endedAt: closeTime, lastActivityAt: closeTime } }
  );
}

/** Close all ACTIVE attendances for a user older than today (IST) */
export async function closeStaleAttendancesForUser(userId: string | object, todayStr?: string) {
  await connectDB();
  const today = todayStr || getISTDateString(new Date());
  const stale = await Attendance.find({
    user: userId,
    status: "ACTIVE",
    attendanceDate: { $lt: today },
  })
    .select("_id attendanceDate")
    .lean();
  for (const doc of stale) {
    const d = doc as unknown as { _id: unknown; attendanceDate: string };
    const closeTime = getISTDayEndUTC(d.attendanceDate);
    await closeDoc(d._id, closeTime);
  }
  return stale.length;
}

/** Close stale ACTIVE EngineerShifts started before today (IST). Same day-rollover
 *  problem as attendance: engineer closes browser without logout, GPS shift stays
 *  ACTIVE forever and the locations page shows a green Active badge. */
export async function closeStaleEngineerShifts(todayStr?: string, limit = 200) {
  await connectDB();
  const { EngineerShift } = await import("@/models/EngineerShift");
  const today = todayStr || getISTDateString(new Date());
  const dayStartUTC = new Date(`${today}T00:00:00+05:30`);
  const stale = await EngineerShift.find({ status: "ACTIVE", startedAt: { $lt: dayStartUTC } })
    .select("_id startedAt")
    .limit(limit)
    .lean();
  for (const doc of stale) {
    const d = doc as unknown as { _id: string | object; startedAt: Date };
    const istDate = getISTDateString(new Date(d.startedAt));
    const closeTime = getISTDayEndUTC(istDate);
    await EngineerShift.updateOne({ _id: d._id as never }, { $set: { status: "ENDED", endedAt: closeTime } });
  }
  return stale.length;
}

/** Close stale ACTIVE EngineerShifts for one engineer */
export async function closeStaleEngineerShiftsForEngineer(engineerId: string | object, todayStr?: string) {
  await connectDB();
  const { EngineerShift } = await import("@/models/EngineerShift");
  const today = todayStr || getISTDateString(new Date());
  const dayStartUTC = new Date(`${today}T00:00:00+05:30`);
  const stale = await EngineerShift.find({ engineer: engineerId, status: "ACTIVE", startedAt: { $lt: dayStartUTC } })
    .select("_id startedAt")
    .lean();
  for (const doc of stale) {
    const d = doc as unknown as { _id: string | object; startedAt: Date };
    const istDate = getISTDateString(new Date(d.startedAt));
    const closeTime = getISTDayEndUTC(istDate);
    await EngineerShift.updateOne({ _id: d._id as never }, { $set: { status: "ENDED", endedAt: closeTime } });
  }
  return stale.length;
}

/** Lazy cleanup for all users: close every ACTIVE attendance older than today */
export async function closeAllStaleAttendances(todayStr?: string, limit = 200) {
  await connectDB();
  const today = todayStr || getISTDateString(new Date());
  const stale = await Attendance.find({
    status: "ACTIVE",
    attendanceDate: { $lt: today },
  })
    .select("_id attendanceDate")
    .limit(limit)
    .lean();
  for (const doc of stale) {
    const d = doc as unknown as { _id: unknown; attendanceDate: string };
    const closeTime = getISTDayEndUTC(d.attendanceDate);
    await closeDoc(d._id, closeTime);
  }
  return stale.length;
}
