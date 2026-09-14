/**
 * Attendance helpers - India (Asia/Kolkata) daily attendance
 */

export function getISTDateString(date: Date = new Date()): string {
  // Use Asia/Kolkata timezone to avoid UTC date drift
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getISTDateRange(dateStr: string): { start: Date; end: Date } {
  // dateStr YYYY-MM-DD in IST, convert to UTC range for queries if needed
  // We store attendanceDate as string, so direct string comparison works
  return { start: new Date(dateStr), end: new Date(dateStr) };
}

export type AttendanceSession = {
  loginAt: Date;
  logoutAt?: Date;
};

export function calculateTotalDurationMs(sessions: AttendanceSession[], now: Date = new Date()): number {
  let total = 0;
  for (const s of sessions) {
    const start = new Date(s.loginAt).getTime();
    const end = s.logoutAt ? new Date(s.logoutAt).getTime() : now.getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      total += end - start;
    }
  }
  return total;
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function hasOpenSession(sessions: AttendanceSession[] | undefined): boolean {
  if (!sessions || sessions.length === 0) return false;
  const last = sessions[sessions.length - 1] as unknown as { logoutAt?: Date | null };
  return !last.logoutAt;
}

export function normalizeAttendanceStatus(att: { sessions?: AttendanceSession[]; status?: string; endedAt?: Date | null }): { hasOpen: boolean } {
  const hasOpen = hasOpenSession(att.sessions);
  return { hasOpen };
}
