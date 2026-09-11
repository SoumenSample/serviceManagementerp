// AUDIT FEATURE TEMPORARILY HIDDEN — not deleted, just commented/hidden per request
// To re-enable: remove the early return below and restore original component
// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";

const MODULES = ["", "AUTH","USER","CUSTOMER","SITE","EQUIPMENT","AMC","SERVICE_CALL","SERVICE_VISIT","PART","INVENTORY","PART_REQUEST","EXPENSE","INVOICE","PAYMENT","SETTINGS"] as const;
const ACTIONS = ["", "CREATE","UPDATE","DELETE","ASSIGN","UNASSIGN","STATUS_CHANGE","APPROVE","REJECT","SUBMIT","CANCEL","REOPEN","TRANSFER","RENEW","PAYMENT","LOGIN_SUCCESS","LOGIN_FAILURE","LOGOUT","OTP_REQUEST","OTP_VERIFY_SUCCESS","OTP_VERIFY_FAILURE","CLOSE"] as const;

type Audit = {
  _id: string;
  auditId: string;
  actor?: { name: string; email: string; role: string } | string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  module: string;
  recordId?: string;
  recordType?: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

function formatActor(a: Audit): string {
  if (a.actorName) return `${a.actorName} (${a.actorRole || ""})`;
  if (typeof a.actor === "object" && a.actor !== null) return `${(a.actor as { name: string }).name} ${(a.actor as { email: string }).email || ""}`;
  if (a.actorEmail) return a.actorEmail;
  return "-";
}

export default function AuditLogsPage() {
  // TEMPORARILY HIDDEN — not deleted, just hidden + redirect per request (dont show page when someone writes /audit-logs)
  // Direct access to /dashboard/audit-logs now redirects to /dashboard (alternative: notFound() for 404)
  // Keep all audit code below preserved but unreachable — to re-enable, remove this redirect block
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
  const [items, setItems] = useState<Audit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [recordId, setRecordId] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Audit | null>(null);
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    setLoading(true);
    setForbidden(false);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (moduleFilter) params.set("module", moduleFilter);
    if (actionFilter) params.set("action", actionFilter);
    if (recordId) params.set("recordId", recordId);
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/audit-logs?${params.toString()}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [page]);
  // debounce search not needed, manual button

  if (forbidden) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Logs" description="Immutable audit trail — who, what, when, before/after" />
        <Card><CardContent className="p-6 text-sm text-destructive">Forbidden: audit.view required. Engineers cannot browse global audit history. Use Service Call Activity timeline for scoped history.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Immutable trail — WHO, WHAT, WHEN, WHERE, BEFORE/AFTER" />

      <Card>
        <CardHeader><CardTitle className="text-sm">Filters</CardTitle><CardDescription>Paginated (50/page, max 100), indexed on module/action/recordId/createdAt</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={moduleFilter || "all"} onValueChange={(v) => setModuleFilter(!v || v === "all" ? "" : String(v))}><SelectTrigger><SelectValue placeholder="Module" /></SelectTrigger><SelectContent><SelectItem value="all">All Modules</SelectItem>{MODULES.filter(Boolean).map((m) => <SelectItem key={m} value={m as string}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(!v || v === "all" ? "" : String(v))}><SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger><SelectContent><SelectItem value="all">All Actions</SelectItem>{ACTIONS.filter(Boolean).map((a) => <SelectItem key={a} value={a as string}>{a}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Record ID (e.g. SC-2026-000001)" value={recordId} onChange={(e) => setRecordId(e.target.value)} />
            <Input placeholder="Search description/auditId" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
            <Button onClick={() => { setPage(1); load(); }}>Apply Filters</Button>
            <Button variant="outline" onClick={() => { setModuleFilter(""); setActionFilter(""); setRecordId(""); setSearch(""); setFrom(""); setTo(""); setPage(1); setTimeout(load, 100); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle><CardDescription>{total} total • Page {page} of {totalPages}</CardDescription></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">No audit logs found</p> : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Audit ID</TableHead><TableHead>Actor</TableHead><TableHead>Module</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a._id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{a.auditId}</TableCell>
                      <TableCell className="text-xs">{a.actorName || a.actorEmail || formatActor(a)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{a.module}</Badge></TableCell>
                      <TableCell><Badge variant={a.action.includes("FAILURE") ? "destructive" : a.action === "CREATE" ? "default" : "secondary"} className="text-[10px]">{a.action}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{a.recordId || "-"}</TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate" title={a.description}>{a.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p=>p-1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p=>p+1)}>Next</Button></div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o)=> !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{selected?.auditId} — {selected?.action} • {selected?.module}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Actor</span><p className="font-medium">{formatActor(selected)} {selected.actorRole ? `• ${selected.actorRole}` : ""}</p><p className="text-muted-foreground">{selected.actorEmail || ""}</p></div>
                <div><span className="text-muted-foreground">Timestamp</span><p>{new Date(selected.createdAt).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Module</span><p><Badge variant="outline">{selected.module}</Badge></p></div>
                <div><span className="text-muted-foreground">Action</span><p><Badge>{selected.action}</Badge></p></div>
                <div><span className="text-muted-foreground">Record</span><p className="font-mono">{selected.recordId || "-"} {selected.recordType ? `• ${selected.recordType}` : ""}</p></div>
                <div><span className="text-muted-foreground">Description</span><p>{selected.description}</p></div>
              </div>
              {selected.before && <div><p className="font-medium text-xs">Before</p><pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">{JSON.stringify(selected.before, null, 2)}</pre></div>}
              {selected.after && <div><p className="font-medium text-xs">After</p><pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">{JSON.stringify(selected.after, null, 2)}</pre></div>}
              {selected.metadata && <div><p className="font-medium text-xs">Metadata</p><pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">{JSON.stringify(selected.metadata, null, 2)}</pre></div>}
              <p className="text-[11px] text-muted-foreground">Immutable — no edit/delete endpoint exists. Sensitive fields are redacted as [REDACTED].</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
