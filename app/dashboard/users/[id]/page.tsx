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

function canEditUserClient(editorRole: string, targetRole: string, editorId: string, targetId: string): boolean {
  if (String(editorId) === String(targetId)) return true;
  if (editorRole === "super_admin") return true;
  if (editorRole === "manager") {
    if (targetRole === "super_admin") return false;
    return ["manager", "coordinator", "engineer", "accounts"].includes(targetRole);
  }
  return false;
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<{ assigned: number; open: number; completed: number } | null>(null);
  const [role, setRole] = useState("");
  const [newPass, setNewPass] = useState("");
  const [me, setMe] = useState<{ sub: string; role: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", mobile: "", employeeId: "", designation: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/users/${id}`);
    if (res.ok) {
      const u = await res.json();
      setUser(u);
      setRole(u.role);
      setEditForm({ name: u.name || "", email: u.email || "", mobile: u.mobile || "", employeeId: u.employeeId || "", designation: u.designation || "" });
    }
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        if (d.user) setMe({ sub: d.user.sub, role: d.user.role });
      }
    });
  }, []);
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
  const canEdit = me ? canEditUserClient(me.role, user.role, me.sub, user._id) : false;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
        <Link href="/dashboard/users"><Button variant="outline" size="sm">Back</Button></Link>
      </div>
      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">User Details</CardTitle>{canEdit && !editMode && <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>Edit</Button>}</CardHeader><CardContent className="space-y-2 text-sm">
        {!editMode ? (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{user.mobile || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><span className="font-mono">{user.employeeId || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Designation</span><span>{user.designation || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Role</span><Badge variant="outline">{user.role}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={user.isActive ? "default" : "secondary"}>{user.isActive ? "Active" : "Inactive"}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(user.createdAt).toLocaleString()}</span></div>
            {!canEdit && <p className="text-xs text-destructive pt-2">You do not have permission to edit this profile. Manager cannot edit super_admin; super_admin can edit everyone.</p>}
          </>
        ) : (
          <div className="space-y-3">
            {!canEdit && <p className="text-xs text-destructive">You do not have permission to edit this profile.</p>}
            <div className="grid gap-3">
              <div><label className="text-xs text-muted-foreground">Name</label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} disabled={!canEdit} /></div>
              <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} disabled={!canEdit} /></div>
              <div><label className="text-xs text-muted-foreground">Mobile</label><Input value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} disabled={!canEdit} /></div>
              <div><label className="text-xs text-muted-foreground">Employee ID</label><Input value={editForm.employeeId} onChange={(e) => setEditForm((f) => ({ ...f, employeeId: e.target.value }))} disabled={!canEdit} /></div>
              <div><label className="text-xs text-muted-foreground">Designation</label><Input value={editForm.designation} onChange={(e) => setEditForm((f) => ({ ...f, designation: e.target.value }))} disabled={!canEdit} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setEditMode(false); if (user) setEditForm({ name: user.name || "", email: user.email || "", mobile: user.mobile || "", employeeId: user.employeeId || "", designation: user.designation || "" }); }}>Cancel</Button>
              <Button size="sm" disabled={!canEdit || saving} onClick={async () => {
                setSaving(true);
                const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editForm.name, email: editForm.email, mobile: editForm.mobile, employeeId: editForm.employeeId, designation: editForm.designation }) });
                setSaving(false);
                if (res.ok) { alert("Profile updated"); setEditMode(false); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
              }}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        )}
      </CardContent></Card>

      {user.role === "engineer" && stats && (
        <Card><CardHeader><CardTitle className="text-sm">Engineer Activity</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted-foreground">Assigned</p><p className="text-xl font-bold">{stats.assigned}</p></div>
          <div><p className="text-muted-foreground">Open</p><p className="text-xl font-bold">{stats.open}</p></div>
          <div><p className="text-muted-foreground">Completed</p><p className="text-xl font-bold">{stats.completed}</p></div>
        </CardContent></Card>
      )}

      <Card><CardHeader><CardTitle className="text-sm">Change Role</CardTitle></CardHeader><CardContent className="space-y-2">
        {!canEdit && <p className="text-xs text-destructive">You do not have permission to edit this profile. Manager cannot edit super_admin; super_admin can edit everyone.</p>}
        <div className="flex gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as string)} disabled={!canEdit}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="super_admin">super_admin</SelectItem><SelectItem value="manager">manager</SelectItem><SelectItem value="coordinator">coordinator</SelectItem><SelectItem value="engineer">engineer</SelectItem><SelectItem value="accounts">accounts</SelectItem></SelectContent></Select>
        <Button size="sm" disabled={!canEdit} onClick={async () => {
          const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
          if (res.ok) { alert("Role updated"); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
        }}>Update</Button>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Admin Password Reset</CardTitle></CardHeader><CardContent className="space-y-2">
        {!canEdit && <p className="text-xs text-destructive">No permission to reset password for this user.</p>}
        <div className="flex gap-2">
        <Input type="password" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} disabled={!canEdit} />
        <Button size="sm" disabled={!canEdit} onClick={async () => {
          if (!newPass) return;
          const res = await fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: newPass, confirmPassword: newPass }) });
          if (res.ok) { alert("Password reset"); setNewPass(""); } else alert("Failed: " + JSON.stringify(await res.json()));
        }}>Reset</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
