"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Attendance = {
  _id: string;
  attendanceId: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  endedAt?: string;
};

export function AttendanceHeader() {
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [latest, setLatest] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const d = await res.json();
        setAttendance(d.attendance || null);
        setLatest(d.latest || null);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAttendance();
    const id = setInterval(fetchAttendance, 30000);
    const handler = () => fetchAttendance();
    window.addEventListener("attendance-ended", handler);
    window.addEventListener("attendance-started", handler);
    return () => {
      clearInterval(id);
      window.removeEventListener("attendance-ended", handler);
      window.removeEventListener("attendance-started", handler);
    };
  }, [fetchAttendance]);

  const handleEndShift = async () => {
    if (!confirm("End your shift? This will mark your attendance as ended. For engineers, GPS tracking will also stop.")) return;
    const res = await fetch("/api/attendance/end", { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setAttendance(d.attendance || null);
      if (d.attendance) setLatest(d.attendance);
      else {
        // fetch latest to show ended state
        fetchAttendance();
      }
      // Notify trackers to stop GPS
      window.dispatchEvent(new CustomEvent("attendance-ended"));
      // simple toast via alert
      // refetch to reflect
      fetchAttendance();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to end shift");
    }
  };

  if (loading) return <span className="text-xs text-muted-foreground">Loading shift...</span>;

  if (attendance?.status === "ACTIVE") {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-green-600 hidden sm:inline-flex">🟢 Shift Active</Badge>
        <Badge className="bg-green-600 sm:hidden">🟢 Active</Badge>
        <span className="hidden md:inline text-xs text-muted-foreground">Started: {new Date(attendance.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <Button size="xs" variant="destructive" onClick={handleEndShift} className="h-7">End Shift</Button>
      </div>
    );
  }

  // Ended state - show latest ended time if available
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">⚪ Shift Ended</Badge>
      {latest?.endedAt && <span className="hidden md:inline text-xs text-muted-foreground">Ended: {new Date(latest.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
    </div>
  );
}
