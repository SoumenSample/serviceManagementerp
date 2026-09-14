"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAppAlert } from "@/components/common/alert-provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

type PR = { _id: string; requestId: string; part: { partNumber: string; name: string }; serviceCall: { callId: string }; serviceVisit: { visitId: string }; quantity: number; status: string; requestedAt: string };

export default function PartRequestsPage() {
  const { showAlert } = useAppAlert();
  const [items, setItems] = useState<PR[]>([]);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState<{ id: string; next: string } | null>(null);

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/part-requests?${params.toString()}`);
    if (res.ok) { const d = await res.json(); setItems(d.items); setTotalPages(d.totalPages); }
  }
  useEffect(() => { load(); }, [status, page]);

  const transitions: Record<string, string[]> = {
    REQUIRED: ["REQUESTED"], REQUESTED: ["APPROVED"], APPROVED: ["DISPATCHED"], DISPATCHED: ["RECEIVED"], RECEIVED: ["USED"],
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Part Requests" description="REQUIRED→REQUESTED→APPROVED→DISPATCHED→RECEIVED→USED — inventory authoritative via StockMovement" />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v as string); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="REQUIRED">REQUIRED</SelectItem><SelectItem value="REQUESTED">REQUESTED</SelectItem><SelectItem value="APPROVED">APPROVED</SelectItem><SelectItem value="DISPATCHED">DISPATCHED</SelectItem><SelectItem value="RECEIVED">RECEIVED</SelectItem><SelectItem value="USED">USED</SelectItem></SelectContent></Select>
        </div>
        {items.length === 0 ? <EmptyState title="No part requests" description="Engineer creates from visit" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>Part</TableHead><TableHead>Qty</TableHead><TableHead>Service Call</TableHead><TableHead>Visit</TableHead><TableHead>Status</TableHead><TableHead>Next Action</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((r) => {
              const next = transitions[r.status]?.[0];
              return <TableRow key={r._id}><TableCell className="font-mono text-xs">{r.requestId}</TableCell><TableCell>{r.part.partNumber} • {r.part.name}</TableCell><TableCell>{r.quantity}</TableCell><TableCell className="font-mono text-xs">{r.serviceCall?.callId}</TableCell><TableCell className="font-mono text-xs">{r.serviceVisit?.visitId}</TableCell><TableCell><Badge variant={r.status === "USED" ? "secondary" : r.status === "REJECTED" ? "destructive" : "outline"}>{r.status}</Badge></TableCell><TableCell>{next ? <Button size="xs" variant="outline" onClick={() => setAction({ id: r._id, next })}>→ {next}</Button> : "-"}</TableCell></TableRow>;
            })}</TableBody>
          </Table>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent><DialogHeader><DialogTitle>Transition to {action?.next}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Server will validate transition + inventory atomically + create StockMovement.</p>
          <DialogFooter><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button onClick={async () => {
            if (!action) return;
            const res = await fetch(`/api/part-requests/${action.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action.next }) });
            if (res.ok) { setAction(null); load(); } else await showAlert("Failed: " + JSON.stringify(await res.json()), "Error");
          }}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
