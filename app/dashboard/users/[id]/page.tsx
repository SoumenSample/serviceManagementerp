"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

type UserDetail = { _id: string; name: string; email: string; role: string; mobile?: string; employeeId?: string; designation?: string; isActive: boolean; createdAt: string; updatedAt: string };

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<{ assigned: number; open: number; completed: number } | null>(null);
  const [role, setRole] = useState("");
  const [newPass, setNewPass] = useState("");

  async function load() {
    const res = await fetch(`/api/users/${id}`);
    if (res.ok) { const u = await res.json(); setUser(u); setRole(u.role); }
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (user?.role === "engineer") {
      fetch("/api/service-calls?limit=100").then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          const calls = d.items as { assignedEngineer?: { _id: string } | string; currentStatus: string }[];
          const assigned = calls.filter((c) => String(typeof c.assignedEngineer === "object" ? (c.assignedEngineer as { _id: string })._id : c.assignedEngineer) === id).length;
          const open = calls.filter((c) => String(typeof c.assignedEngineer === "object" ? (c.assignedEngineer as { _id: string })._id : c.assignedEngineer) === id && !["CLOSED", "CANCELLED"].includes(c.currentStatus)).length;
          setStats({ assigned, open, completed: assigned - open });
        }
      });
    }
  }, [user]);

  if (!user) return <div className="p-6 text-sm text-muted-foreground">Loading user...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
        <Link href="/dashboard/users"><Button variant="outline" size="sm">Back</Button></Link>
      </div>
      <Card><CardHeader><CardTitle className="text-sm">User Details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{user.mobile || "-"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><span className="font-mono">{user.employeeId || "-"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Designation</span><span>{user.designation || "-"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Role</span><Badge variant="outline">{user.role}</Badge></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={user.isActive ? "default" : "secondary"}>{user.isActive ? "Active" : "Inactive"}</Badge></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(user.createdAt).toLocaleString()}</span></div>
      </CardContent></Card>

      {user.role === "engineer" && stats && (
        <Card><CardHeader><CardTitle className="text-sm">Engineer Activity</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted-foreground">Assigned</p><p className="text-xl font-bold">{stats.assigned}</p></div>
          <div><p className="text-muted-foreground">Open</p><p className="text-xl font-bold">{stats.open}</p></div>
          <div><p className="text-muted-foreground">Completed</p><p className="text-xl font-bold">{stats.completed}</p></div>
        </CardContent></Card>
      )}

      <Card><CardHeader><CardTitle className="text-sm">Change Role</CardTitle></CardHeader><CardContent className="flex gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as string)}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="super_admin">super_admin</SelectItem><SelectItem value="manager">manager</SelectItem><SelectItem value="coordinator">coordinator</SelectItem><SelectItem value="engineer">engineer</SelectItem><SelectItem value="accounts">accounts</SelectItem></SelectContent></Select>
        <Button size="sm" onClick={async () => {
          const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
          if (res.ok) { alert("Role updated"); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
        }}>Update</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Admin Password Reset</CardTitle></CardHeader><CardContent className="flex gap-2">
        <Input type="password" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        <Button size="sm" onClick={async () => {
          if (!newPass) return;
          const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: newPass, confirmPassword: newPass }) });
          if (res.ok) { alert("Password reset"); setNewPass(""); } else alert("Failed: " + JSON.stringify(await res.json()));
        }}>Reset</Button>
      </CardContent></Card>
    </div>
  );
}
