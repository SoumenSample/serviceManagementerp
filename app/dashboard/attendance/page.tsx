"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

type AttendanceItem = {
  _id: string;
  attendanceId: string;
  attendanceDate?: string;
  user: { _id: string; name: string; email: string; employeeId?: string; role: string } | string;
  role: string;
  startedAt: string;
  endedAt?: string;
  status: "ACTIVE" | "ENDED";
  lastActivityAt?: string;
  sessions?: { loginAt: string; logoutAt?: string }[];
};

function calcTotalDuration(sessions?: { loginAt: string; logoutAt?: string }[], startedAt?: string, endedAt?: string, nowTick?: number): string {
  // Prefer sessions sum
  if (sessions && sessions.length > 0) {
    let totalMs = 0;
    const now = Date.now();
    void nowTick;
    for (const s of sessions) {
      const st = new Date(s.loginAt).getTime();
      const en = s.logoutAt ? new Date(s.logoutAt).getTime() : now;
      if (!isNaN(st) && !isNaN(en) && en >= st) totalMs += en - st;
    }
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const hasOpen = sessions.some((x) => !x.logoutAt);
    if (hasOpen) return `${h}h ${m}m (live)`;
    const s = Math.floor((totalMs % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }
  // Fallback for old records without sessions
  const start = new Date(startedAt || "").getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function formatDateIST(dateStr?: string, fallback?: string) {
  if (dateStr) {
    // dateStr is YYYY-MM-DD
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (fallback) return new Date(fallback).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return "-";
}

export default function AttendancePage() {
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<{ role: string; sub: string } | null>(null);
  const [isManagerial, setIsManagerial] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        if (d.user) {
          setMe({ role: d.user.role, sub: d.user.sub });
          setIsManagerial(["super_admin", "manager", "coordinator", "accounts"].includes(d.user.role));
        }
      }
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (q) params.set("q", q);
    if (role !== "all") params.set("role", role);
    if (status !== "all") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const url = isManagerial ? `/api/attendance/list?${params.toString()}` : `/api/attendance/history?${params.toString()}`;
    const res = await fetch(url);
    setLoading(false);
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } else if (res.status === 403) {
      setItems([]);
    }
  }, [me, isManagerial, page, q, role, status, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, role, status, from, to]);

  void tick;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={isManagerial ? "Daily attendance — one row per employee per day" : "Your daily attendance"} />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search attendance ID, name, email..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={role} onValueChange={(v) => setRole(v as string)}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="all">All Roles</SelectItem><SelectItem value="super_admin">super_admin</SelectItem><SelectItem value="manager">manager</SelectItem><SelectItem value="coordinator">coordinator</SelectItem><SelectItem value="engineer">engineer</SelectItem><SelectItem value="accounts">accounts</SelectItem></SelectContent></Select>
          <Select value={status} onValueChange={(v) => setStatus(v as string)}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="ENDED">Ended</SelectItem></SelectContent></Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          <Button variant="outline" size="sm" onClick={() => { setQ(""); setRole("all"); setStatus("all"); setFrom(""); setTo(""); }}>Clear</Button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? <EmptyState title="No attendance" description="No daily attendance matches filters" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Attendance ID</TableHead><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Date</TableHead><TableHead>First Login</TableHead><TableHead>Last Logout</TableHead><TableHead>Sessions</TableHead><TableHead>Worked</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((a) => {
              const user = typeof a.user === "object" ? a.user : null;
              const sessions = a.sessions || [];
              const lastLogout = sessions.length > 0 ? sessions[sessions.length - 1].logoutAt : a.endedAt;
              const firstLogin = sessions.length > 0 ? sessions[0].loginAt : a.startedAt;
              return (
                <TableRow key={a._id}>
                  <TableCell className="font-mono text-xs">{a.attendanceId}</TableCell>
                  <TableCell className="text-xs">{user ? `${user.name} (${user.email})` : a.role}</TableCell>
                  <TableCell><Badge variant="outline">{a.role}</Badge></TableCell>
                  <TableCell className="text-xs">{formatDateIST(a.attendanceDate, a.startedAt)}</TableCell>
                  <TableCell className="text-xs">{firstLogin ? new Date(firstLogin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                  <TableCell className="text-xs">{lastLogout ? new Date(lastLogout).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (a.status === "ACTIVE" ? "Active" : "-")}</TableCell>
                  <TableCell className="text-xs text-center">{sessions.length > 0 ? sessions.length : 1}</TableCell>
                  <TableCell className="text-xs">{calcTotalDuration(sessions, a.startedAt, a.endedAt, tick)}</TableCell>
                  <TableCell>{a.status === "ACTIVE" ? <Badge className="bg-green-600">🟢 Active</Badge> : <Badge variant="outline">⚪ Ended</Badge>}</TableCell>
                  <TableCell><Link href={`/dashboard/attendance/${a.attendanceId}`}><Button size="xs" variant="outline">View</Button></Link></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages} • Total {total}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>
    </div>
  );
}
