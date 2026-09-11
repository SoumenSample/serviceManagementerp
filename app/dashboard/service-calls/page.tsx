"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge, PriorityBadge } from "@/components/service-calls/status-badge";
import { getPendingSince } from "@/lib/servicecall-helpers";

type Call = {
  _id: string; callId: string; problemDescription: string; priority: string; currentStatus: string; nextAction?: string; targetVisitDate?: string; createdAt: string;
  customer: { companyName: string }; site: { siteName: string }; equipment?: { equipmentId: string }; assignedEngineer?: { name: string };
};

export default function ServiceCallsPage() {
  const [items, setItems] = useState<Call[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Call | null>(null);
  const [editPriority, setEditPriority] = useState("");
  const [editProblem, setEditProblem] = useState("");
  const [editTargetVisit, setEditTargetVisit] = useState("");
  const [editTargetResolution, setEditTargetResolution] = useState("");
  const [myRole, setMyRole] = useState<string>("");

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    if (overdue) params.set("overdue", "true");
    const res = await fetch(`/api/service-calls?${params.toString()}`);
    if (res.ok) { const d = await res.json(); setItems(d.items); setTotalPages(d.totalPages); }
  }
  useEffect(() => { load(); }, [q, status, priority, overdue, page]);
  useEffect(() => { fetch("/api/auth/me").then(async (r) => { if (r.ok) { const j = await r.json(); setMyRole(j.user?.role || ""); } }).catch(() => {}); }, []);

  function openEdit(c: Call) {
    setEditItem(c);
    setEditPriority(c.priority);
    setEditProblem(c.problemDescription);
    setEditTargetVisit((c as unknown as { targetVisitDate?: string }).targetVisitDate ? new Date((c as unknown as { targetVisitDate: string }).targetVisitDate).toISOString().slice(0,10) : "");
    setEditTargetResolution((c as unknown as { targetResolutionDate?: string }).targetResolutionDate ? new Date((c as unknown as { targetResolutionDate: string }).targetResolutionDate).toISOString().slice(0,10) : "");
    setEditOpen(true);
  }
  async function handleEditSave() {
    if (!editItem) return;
    const res = await fetch(`/api/service-calls/${editItem._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: editPriority, problemDescription: editProblem, targetVisitDate: editTargetVisit || undefined, targetResolutionDate: editTargetResolution || undefined }) });
    if (res.ok) { setEditOpen(false); load(); } else alert("Edit failed: " + JSON.stringify(await res.json()));
  }
  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this service call? This cannot be undone.")) return;
    const res = await fetch(`/api/service-calls/${id}`, { method: "DELETE" });
    if (res.ok) load(); else alert("Delete failed: " + JSON.stringify(await res.json()));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Service Calls" description="Pending calls — largest operational section" action={<Link href="/dashboard/service-calls/new"><Button>New Complaint</Button></Link>} />

      <div className="grid gap-2">
        <Card className="border-l-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">PENDING SERVICE CALLS</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search Call ID, Equipment, Customer..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
              <Select value={status} onValueChange={(v) => { setStatus(v as string); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="NEW">NEW</SelectItem><SelectItem value="ASSIGNED">ASSIGNED</SelectItem><SelectItem value="PARTS_REQUIRED">PARTS_REQUIRED</SelectItem><SelectItem value="WORK_COMPLETED">WORK_COMPLETED</SelectItem><SelectItem value="CLOSED">CLOSED</SelectItem></SelectContent></Select>
              <Select value={priority} onValueChange={(v) => { setPriority(v as string); setPage(1); }}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger><SelectContent><SelectItem value="all">All Priority</SelectItem><SelectItem value="CRITICAL">CRITICAL</SelectItem><SelectItem value="HIGH">HIGH</SelectItem><SelectItem value="MEDIUM">MEDIUM</SelectItem><SelectItem value="LOW">LOW</SelectItem></SelectContent></Select>
              <Button variant={overdue ? "destructive" : "outline"} size="sm" onClick={() => { setOverdue(!overdue); setPage(1); }}>{overdue ? "Overdue only" : "Show Overdue"}</Button>
            </div>

            {items.length === 0 ? <EmptyState title="No service calls" description="Create your first complaint — SC-YYYY-000001" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Call ID</TableHead><TableHead>Site</TableHead><TableHead>Equipment</TableHead><TableHead>Problem</TableHead><TableHead>Engineer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Pending Since</TableHead><TableHead>Next Action</TableHead><TableHead>Priority</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{items.map((c) => {
                    const isOverdue = c.targetVisitDate ? new Date(c.targetVisitDate) < new Date() && !["CLOSED", "CANCELLED"].includes(c.currentStatus) : false;
                    const isClosed = ["CLOSED", "CANCELLED"].includes(c.currentStatus);
                    return (
                      <TableRow key={c._id} className={`${isOverdue ? "bg-destructive/5" : ""} ${(c.priority === "CRITICAL" || c.priority === "HIGH") ? "border-l-2 border-l-destructive" : ""}`}>
                        <TableCell className="font-mono text-xs font-medium cursor-pointer hover:underline" onClick={() => window.location.href = `/dashboard/service-calls/${c._id}`}>{c.callId}</TableCell>
                        <TableCell>{c.site?.siteName || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.equipment?.equipmentId || "-"}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs">{c.problemDescription}</TableCell>
                        <TableCell className="text-xs">{c.assignedEngineer?.name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell className="text-xs">{new Date(c.createdAt).toLocaleDateString()} {isOverdue && <Badge variant="destructive" className="ml-1">Overdue</Badge>}</TableCell>
                        <TableCell><StatusBadge status={c.currentStatus} /></TableCell>
                        <TableCell className="text-xs">{getPendingSince(c.createdAt)}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{c.nextAction || "-"}</TableCell>
                        <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="xs" variant="outline" disabled={isClosed} onClick={(e) => { e.stopPropagation(); openEdit(c); }}>Edit</Button>
                            <Button size="xs" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}</TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Service Call</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Priority</Label><Select value={editPriority} onValueChange={(v) => setEditPriority(v as string)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CRITICAL">CRITICAL</SelectItem><SelectItem value="HIGH">HIGH</SelectItem><SelectItem value="MEDIUM">MEDIUM</SelectItem><SelectItem value="LOW">LOW</SelectItem></SelectContent></Select></div>
            <div><Label>Problem Description</Label><Textarea value={editProblem} onChange={(e) => setEditProblem(e.target.value)} placeholder="Describe problem..." /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Target Visit Date</Label><Input type="date" value={editTargetVisit} onChange={(e) => setEditTargetVisit(e.target.value)} /></div><div><Label>Target Resolution Date</Label><Input type="date" value={editTargetResolution} onChange={(e) => setEditTargetResolution(e.target.value)} /></div></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

