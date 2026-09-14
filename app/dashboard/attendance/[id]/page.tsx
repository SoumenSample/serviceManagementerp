"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Session = { loginAt: string; logoutAt?: string };
type Attendance = {
  attendanceId: string;
  attendanceDate?: string;
  user: { name: string; email: string; employeeId?: string; role: string };
  role: string;
  startedAt: string;
  endedAt?: string;
  status: "ACTIVE" | "ENDED";
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  sessions?: Session[];
};

function calcSessionDuration(loginAt: string, logoutAt?: string): string {
  const st = new Date(loginAt).getTime();
  const en = logoutAt ? new Date(logoutAt).getTime() : Date.now();
  const diff = Math.max(0, en - st);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}
function calcTotal(sessions?: Session[], startedAt?: string, endedAt?: string): string {
  if (sessions && sessions.length > 0) {
    let total = 0;
    const now = Date.now();
    for (const s of sessions) {
      const st = new Date(s.loginAt).getTime();
      const en = s.logoutAt ? new Date(s.logoutAt).getTime() : now;
      if (!isNaN(st) && !isNaN(en) && en >= st) total += en - st;
    }
    const h = Math.floor(total / 3600000);
    const m = Math.floor((total % 3600000) / 60000);
    const s = Math.floor((total % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }
  const st = new Date(startedAt || "").getTime();
  const en = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diff = Math.max(0, en - st);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function AttendanceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Attendance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/attendance/${id}`).then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setData(d.attendance);
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.error || "Not found");
      }
    });
  }, [id]);

  if (error) return <div className="p-6"><p className="text-sm text-destructive">{error}</p><Link href="/dashboard/attendance"><Button variant="outline" size="sm" className="mt-2">Back</Button></Link></div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading attendance {id}...</div>;

  const sessions = data.sessions && data.sessions.length > 0 ? data.sessions : [{ loginAt: data.startedAt, logoutAt: data.endedAt }];
  const dateStr = data.attendanceDate ? new Date(data.attendanceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : new Date(data.startedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader title={`Attendance ${data.attendanceId}`} description={`${data.user?.name} • ${data.role} • ${dateStr}`} action={<Link href="/dashboard/attendance"><Button variant="outline" size="sm">Back</Button></Link>} />
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2">Status {data.status === "ACTIVE" ? <Badge className="bg-green-600">🟢 Active</Badge> : <Badge variant="outline">⚪ Ended</Badge>}</CardTitle><CardDescription>Date {dateStr} • First login {new Date(data.startedAt).toLocaleString()} {data.endedAt ? `• Last logout ${new Date(data.endedAt).toLocaleString()}` : ""}</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div><p className="text-muted-foreground text-xs">Attendance ID</p><p className="font-mono font-medium">{data.attendanceId}</p></div>
            <div><p className="text-muted-foreground text-xs">Employee</p><p className="font-medium">{data.user?.name} <span className="text-muted-foreground">({data.user?.email})</span></p><p className="text-xs text-muted-foreground">{data.user?.employeeId || ""}</p></div>
            <div><p className="text-muted-foreground text-xs">Role</p><Badge variant="outline">{data.role}</Badge></div>
            <div><p className="text-muted-foreground text-xs">Date (IST)</p><p>{dateStr}</p></div>
            <div><p className="text-muted-foreground text-xs">Total Worked</p><p className="font-medium">{calcTotal(sessions, data.startedAt, data.endedAt)}</p><p className="text-xs text-muted-foreground">{data.status === "ACTIVE" ? "live (open session → now)" : "final (sum of sessions)"}</p></div>
            <div><p className="text-muted-foreground text-xs">Sessions</p><p>{sessions.length}</p></div>
            <div><p className="text-muted-foreground text-xs">Started At</p><p>{new Date(data.startedAt).toLocaleString()}</p></div>
            <div><p className="text-muted-foreground text-xs">Ended At</p><p>{data.endedAt ? new Date(data.endedAt).toLocaleString() : "-"}</p></div>
            <div><p className="text-muted-foreground text-xs">Last Activity</p><p>{data.lastActivityAt ? new Date(data.lastActivityAt).toLocaleString() : "-"}</p></div>
            <div><p className="text-muted-foreground text-xs">Created</p><p className="text-xs">{new Date(data.createdAt).toLocaleString()}</p></div>
          </div>

          <div className="pt-2">
            <p className="font-medium text-sm mb-2">Sessions</p>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Login</TableHead><TableHead>Logout</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {sessions.map((s, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="text-xs">{new Date(s.loginAt).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{s.logoutAt ? new Date(s.logoutAt).toLocaleString() : <Badge className="bg-green-600">Active</Badge>}</TableCell>
                    <TableCell className="text-xs">{calcSessionDuration(s.loginAt, s.logoutAt)}</TableCell>
                    <TableCell>{s.logoutAt ? <Badge variant="outline">Closed</Badge> : <Badge className="bg-green-600">Open</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">Total = sum of each session (open session counts until now). Logout gaps are excluded.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
