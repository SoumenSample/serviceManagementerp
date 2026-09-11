"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { serviceExpenseSchema } from "@/lib/validators";

type Exp = { _id: string; expenseId: string; serviceCall: { callId: string }; serviceVisit?: { visitId: string }; category: string; amount: number; status: string; expenseDate: string; submittedBy: { _id?: string; name: string }; incurredBy: { name: string }; costSource: string; remarks?: string };

export default function ExpensesPage() {
  const [items, setItems] = useState<Exp[]>([]);
  const [serviceCalls, setServiceCalls] = useState<{ _id: string; callId: string }[]>([]);
  const [serviceVisits, setServiceVisits] = useState<{ _id: string; visitId: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCostSource, setFilterCostSource] = useState("all");
  const [myRole, setMyRole] = useState<string>("");
  const [myId, setMyId] = useState<string>("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Exp | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const form = useForm<any>({ resolver: zodResolver(serviceExpenseSchema), defaultValues: { serviceCall: "", serviceVisit: "", category: "TRAVEL", amount: 0, expenseDate: new Date().toISOString().slice(0, 10), costSource: "FIELD", incurredBy: "", description: "" } });

  async function load() {
    const params = new URLSearchParams({ limit: "20" });
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterCostSource !== "all") params.set("costSource", filterCostSource);
    const res = await fetch(`/api/service-expenses?${params.toString()}`);
    if (res.ok) setItems((await res.json()).items);
  }
  useEffect(() => { load(); }, [filterStatus, filterCostSource]);
  useEffect(() => { fetch("/api/service-calls?limit=100").then(async (r) => { if (r.ok) setServiceCalls((await r.json()).items); }); fetch("/api/users?limit=100").then(async (r) => { if (r.ok) setUsers((await r.json()).items); }); fetch("/api/auth/me").then(async (r) => { if (r.ok) { const j = await r.json(); setMyRole(j.user?.role || ""); setMyId(j.user?._id || j.user?.id || ""); } }).catch(() => {}); }, []);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/service-expenses/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPROVED" }) });
    if (res.ok) load(); else alert("Approve failed: " + JSON.stringify(await res.json()));
  }
  async function handleReject() {
    if (!rejectTarget) return;
    if (!rejectRemarks.trim()) return alert("Rejection remarks required");
    const res = await fetch(`/api/service-expenses/${rejectTarget._id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REJECTED", remarks: rejectRemarks.trim() }) });
    if (res.ok) { setRejectOpen(false); setRejectRemarks(""); setRejectTarget(null); load(); } else alert("Reject failed: " + JSON.stringify(await res.json()));
  }
  async function handleResubmit(id: string) {
    if (!confirm("Re-apply this rejected expense? It will be resubmitted for approval.")) return;
    const res = await fetch(`/api/service-expenses/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "SUBMITTED" }) });
    if (res.ok) load(); else alert("Resubmit failed: " + JSON.stringify(await res.json()));
  }
  const selectedCall = form.watch("serviceCall");
  useEffect(() => {
    if (selectedCall) fetch(`/api/service-calls/${selectedCall}/visits`).then(async (r) => { if (r.ok) setServiceVisits((await r.json()).items); });
    else setServiceVisits([]);
  }, [selectedCall]);

  return (
    <div className="space-y-6">
      <PageHeader title="Service Expenses" description="EXP-YYYY-000001 • DRAFT→SUBMITTED→APPROVED (approvedBy ≠ submitter, immutability)" action={<Button onClick={() => setOpen(true)}>New Expense</Button>} />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as string)}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="DRAFT">DRAFT</SelectItem><SelectItem value="SUBMITTED">SUBMITTED</SelectItem><SelectItem value="APPROVED">APPROVED</SelectItem><SelectItem value="REJECTED">REJECTED</SelectItem></SelectContent></Select>
          <Select value={filterCostSource} onValueChange={(v) => setFilterCostSource(v as string)}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Source" /></SelectTrigger><SelectContent><SelectItem value="all">All Sources</SelectItem><SelectItem value="FIELD">FIELD</SelectItem><SelectItem value="SERVICE_CENTER">SERVICE_CENTER</SelectItem><SelectItem value="INTERNAL">INTERNAL</SelectItem></SelectContent></Select>
        </div>
        {items.length === 0 ? <EmptyState title="No expenses" description="Engineer submits, manager approves — rejected can be re-applied" /> : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Expense ID</TableHead><TableHead>Service Call</TableHead><TableHead>Visit</TableHead><TableHead>Incurred By</TableHead><TableHead>Source</TableHead><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead><TableHead>Submitted By</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((e) => {
              const canApprove = ["super_admin","manager","coordinator","accounts"].includes(myRole) && e.status === "SUBMITTED";
              const submittedId = String((e.submittedBy as unknown as { _id?: string })._id || (e as unknown as { submittedBy: string }).submittedBy || "");
              const isOwner = submittedId && myId && submittedId === String(myId);
              const canResubmit = e.status === "REJECTED" && (isOwner || myRole === "engineer");
              return <TableRow key={e._id}><TableCell className="font-mono text-xs">{e.expenseId}</TableCell><TableCell className="font-mono text-xs">{e.serviceCall.callId}</TableCell><TableCell className="font-mono text-xs">{e.serviceVisit?.visitId || "-"}</TableCell><TableCell className="text-xs">{e.incurredBy?.name || "-"}</TableCell><TableCell><Badge variant={e.costSource === "SERVICE_CENTER" ? "default" : "outline"}>{e.costSource || "FIELD"}</Badge></TableCell><TableCell><Badge variant="outline">{e.category}</Badge></TableCell><TableCell>₹{e.amount}</TableCell><TableCell><Badge variant={e.status === "APPROVED" ? "default" : e.status === "REJECTED" ? "destructive" : "secondary"}>{e.status}</Badge></TableCell><TableCell className="text-xs max-w-[150px] truncate" title={e.remarks || ""}>{e.remarks || "-"}</TableCell><TableCell className="text-xs">{e.submittedBy?.name}</TableCell><TableCell>
                {e.status === "SUBMITTED" && canApprove ? <div className="flex gap-1"><Button size="xs" variant="outline" onClick={() => handleApprove(e._id)}>Approve</Button><Button size="xs" variant="destructive" onClick={() => { setRejectTarget(e); setRejectRemarks(e.remarks || ""); setRejectOpen(true); }}>Reject</Button></div> : canResubmit ? <Button size="xs" variant="outline" onClick={() => handleResubmit(e._id)}>Re-apply</Button> : "-"}
              </TableCell></TableRow>;
            })}</TableBody>
          </Table>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (v: unknown) => {
              setLoading(true); const res = await fetch("/api/service-expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); setLoading(false);
              if (res.ok) { setOpen(false); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
            })} className="space-y-3">
              <FormField control={form.control} name="serviceCall" render={({ field }) => (<FormItem><FormLabel>Service Call *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{serviceCalls.map((c) => <SelectItem key={c._id} value={c._id}>{c.callId}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="serviceVisit" render={({ field }) => (<FormItem><FormLabel>Service Visit (first-class)</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Select visit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None (legacy)</SelectItem>{serviceVisits.map((v) => <SelectItem key={v._id} value={v._id}>{v.visitId}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="PARTS">PARTS</SelectItem><SelectItem value="TRAVEL">TRAVEL</SelectItem><SelectItem value="LABOUR">LABOUR</SelectItem><SelectItem value="TRANSPORT">TRANSPORT</SelectItem><SelectItem value="ACCOMMODATION">ACCOMMODATION</SelectItem><SelectItem value="FOOD">FOOD</SelectItem><SelectItem value="TOOLS">TOOLS</SelectItem><SelectItem value="OTHER">OTHER</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount *</FormLabel><FormControl><Input type="number" value={(field.value as string) ?? ""} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="incurredBy" render={({ field }) => (<FormItem><FormLabel>Incurred By</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Self" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Self (default)</SelectItem>{users.map((u) => <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="costSource" render={({ field }) => (<FormItem><FormLabel>Cost Source</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="FIELD">FIELD</SelectItem><SelectItem value="SERVICE_CENTER">SERVICE_CENTER</SelectItem><SelectItem value="INTERNAL">INTERNAL</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="expenseDate" render={({ field }) => (<FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Creating..." : "Submit"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Expense — {rejectTarget?.expenseId}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Provide a rejection remark. Engineer will see this and can re-apply.</p>
            <Textarea placeholder="Reason for rejection..." value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button><Button variant="destructive" disabled={!rejectRemarks.trim()} onClick={handleReject}>Reject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
