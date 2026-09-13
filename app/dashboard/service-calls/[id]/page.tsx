"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, PriorityBadge } from "@/components/service-calls/status-badge";
import { STATUS_TRANSITIONS } from "@/lib/servicecall-helpers";
import { useEffect as useEffect2, useState as useState2 } from "react";
// AUDIT TIMELINE TEMPORARILY HIDDEN — not deleted, just commented per request
// import { ActivityTimeline } from "@/components/service-calls/activity-timeline";

function FinanceSummary({ serviceCallId }: { serviceCallId: string }) {
  const [exp, setExp] = useState2<{ items: { amount: number; status: string; category: string; incurredBy?: { name: string; _id: string }; serviceVisit?: { visitId: string; _id: string }; costSource?: string }[] } | null>(null);
  useEffect2(() => { fetch(`/api/service-expenses?serviceCall=${serviceCallId}&limit=100`).then(async (r) => { if (r.ok) setExp(await r.json()); }); }, [serviceCallId]);
  if (!exp) return <p className="text-sm text-muted-foreground">Loading expenses...</p>;
  const approved = exp.items.filter((e) => e.status === "APPROVED");
  const pending = exp.items.filter((e) => e.status === "SUBMITTED");
  const totalApproved = approved.reduce((s, e) => s + e.amount, 0);
  const byVisit = approved.reduce((acc: Record<string, number>, e) => {
    const k = e.serviceVisit?.visitId || "No Visit";
    acc[k] = (acc[k] || 0) + e.amount;
    return acc;
  }, {});
  const byPerson = approved.reduce((acc: Record<string, number>, e) => {
    const k = (e.incurredBy as unknown as { name: string })?.name || "Unknown";
    acc[k] = (acc[k] || 0) + e.amount;
    return acc;
  }, {});
  const bySource = approved.reduce((acc: Record<string, number>, e) => {
    const k = e.costSource || "FIELD";
    acc[k] = (acc[k] || 0) + e.amount;
    return acc;
  }, {});
  const byCat = approved.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div><p className="text-muted-foreground">Approved Total</p><p className="font-bold">₹{totalApproved}</p></div><div><p className="text-muted-foreground">Pending</p><p>₹{pending.reduce((s, e) => s + e.amount, 0)} ({pending.length})</p></div><div><p className="text-muted-foreground">Total Expenses</p><p>₹{exp.items.reduce((s, e) => s + e.amount, 0)} ({exp.items.length})</p></div><div><p className="text-muted-foreground">Field / Service Center</p><p>₹{bySource["FIELD"] || 0} / ₹{bySource["SERVICE_CENTER"] || 0}</p></div></div>
      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div><p className="font-medium">By Visit</p>{Object.entries(byVisit).map(([k, v]) => <p key={k}>{k}: ₹{v}</p>)}{Object.keys(byVisit).length === 0 && <p className="text-muted-foreground">—</p>}</div>
        <div><p className="font-medium">By Person (incurredBy)</p>{Object.entries(byPerson).map(([k, v]) => <p key={k}>{k}: ₹{v}</p>)}{Object.keys(byPerson).length === 0 && <p className="text-muted-foreground">—</p>}</div>
        <div><p className="font-medium">By Cost Source</p>{Object.entries(bySource).map(([k, v]) => <p key={k}>{k}: ₹{v}</p>)}{Object.entries(bySource).length === 0 && <p className="text-muted-foreground">—</p>}</div>
      </div>
      <div><p className="font-medium text-xs">By Category</p><p className="text-xs text-muted-foreground">{Object.entries(byCat).map(([k, v]) => `${k} ₹${v}`).join(" • ") || "—"}</p></div>
    </div>
  );
}

function VisitsList({ id }: { id: string }) {
  const [visits, setVisits] = useState2<{
    _id: string; visitId: string; status: string; visitPurpose?: string; visitDate: string; visitTime?: string;
    startedAt?: string; completedAt?: string; gpsLatitude?: number; gpsLongitude?: number; gpsAccuracy?: number; gpsTimestamp?: string;
    completionLatitude?: number; completionLongitude?: number; completionGpsAccuracy?: number; completionTimestamp?: string;
    problemFound?: string; diagnosis?: string; workDone?: string; equipmentCondition?: string; engineerRemarks?: string;
    partsUsed?: string[]; partsRequired?: string[];
    beforePhotos?: { url: string; publicId: string; fileName?: string }[]; afterPhotos?: { url: string; publicId: string; fileName?: string }[];
    customerSignature?: { url: string; publicId: string }; signatureReason?: string;
    engineer: { name: string; email?: string };
  }[]>([]);
  const [expanded, setExpanded] = useState2<string | null>(null);
  useEffect2(() => { fetch(`/api/service-calls/${id}/visits`).then(async (r) => { if (r.ok) setVisits((await r.json()).items); }); }, [id]);
  if (visits.length === 0) return <p className="text-sm text-muted-foreground">No visits yet. Create via Add Visit. One call supports many visits with different engineers.</p>;
  return (
    <div className="space-y-3">
      {visits.map((v, idx) => {
        const isOpen = expanded === v._id;
        return (
          <div key={v._id} className="border rounded-lg overflow-hidden">
            <div className="p-3 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-muted/40" onClick={() => setExpanded(isOpen ? null : v._id)}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm flex flex-wrap items-center gap-2">Visit #{idx + 1} <span className="font-mono text-xs bg-background border rounded px-1.5 py-0.5">{v.visitId}</span> <Badge variant={v.status === "COMPLETED" ? "default" : v.status === "IN_PROGRESS" ? "secondary" : "outline"} className="text-[10px]">{v.status}</Badge> <span className="text-xs text-muted-foreground">{v.visitPurpose || "OTHER"}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(v.visitDate).toLocaleDateString()} {v.visitTime || ""} • {v.engineer?.name} • Started {v.startedAt ? new Date(v.startedAt).toLocaleString() : "—"} • Completed {v.completedAt ? new Date(v.completedAt).toLocaleString() : "—"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">{isOpen ? "Hide details" : "View details"}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs">{isOpen ? "Collapse" : "Details"}</Button>
              </div>
            </div>
            {isOpen && (
              <div className="p-4 space-y-4 text-sm bg-background">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><p className="text-xs font-semibold text-muted-foreground">Start GPS</p>{v.gpsLatitude ? <><p className="font-mono text-xs">{v.gpsLatitude.toFixed(6)}, {v.gpsLongitude?.toFixed(6)}</p><p className="text-xs text-muted-foreground">Accuracy ±{v.gpsAccuracy ? Math.round(v.gpsAccuracy) : "?"} m • {v.gpsTimestamp ? new Date(v.gpsTimestamp).toLocaleString() : v.startedAt ? new Date(v.startedAt).toLocaleString() : ""}</p><a href={`https://www.google.com/maps/search/?api=1&query=${v.gpsLatitude},${v.gpsLongitude}`} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">View on Map</a></> : <p className="text-xs text-muted-foreground">— not captured</p>}</div>
                  <div className="space-y-1"><p className="text-xs font-semibold text-muted-foreground">Completion GPS</p>{v.completionLatitude ? <><p className="font-mono text-xs">{v.completionLatitude.toFixed(6)}, {v.completionLongitude?.toFixed(6)}</p><p className="text-xs text-muted-foreground">Accuracy ±{v.completionGpsAccuracy ? Math.round(v.completionGpsAccuracy) : "?"} m • {v.completionTimestamp ? new Date(v.completionTimestamp).toLocaleString() : v.completedAt ? new Date(v.completedAt).toLocaleString() : ""}</p><a href={`https://www.google.com/maps/search/?api=1&query=${v.completionLatitude},${v.completionLongitude}`} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">View on Map</a></> : <p className="text-xs text-muted-foreground">— not captured</p>}</div>
                </div>
                <Separator />
                {v.problemFound && <div><p className="text-xs font-semibold">Problem Found</p><p className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1">{v.problemFound}</p></div>}
                {v.diagnosis && <div><p className="text-xs font-semibold">Diagnosis</p><p className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1">{v.diagnosis}</p></div>}
                {v.workDone && <div><p className="text-xs font-semibold">Work Done</p><p className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1">{v.workDone}</p></div>}
                {v.equipmentCondition && <div><p className="text-xs font-semibold">Equipment Condition</p><Badge variant="outline" className="mt-1">{v.equipmentCondition}</Badge></div>}
                {v.engineerRemarks && <div><p className="text-xs font-semibold">Engineer Remarks</p><p className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1">{v.engineerRemarks}</p></div>}
                {(v.partsRequired?.length || v.partsUsed?.length) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {v.partsRequired?.length ? <div><p className="text-xs font-semibold">Parts Required</p><div className="flex flex-wrap gap-1 mt-1">{v.partsRequired.map((p,i)=><Badge key={i} variant="secondary" className="text-[11px]">{p}</Badge>)}</div></div> : null}
                    {v.partsUsed?.length ? <div><p className="text-xs font-semibold">Parts Used</p><div className="flex flex-wrap gap-1 mt-1">{v.partsUsed.map((p,i)=><Badge key={i} variant="default" className="text-[11px]">{p}</Badge>)}</div></div> : null}
                  </div>
                ) : null}
                {(v.beforePhotos?.length || v.afterPhotos?.length) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {v.beforePhotos?.length ? <div><p className="text-xs font-semibold mb-1">Before Photos ({v.beforePhotos.length})</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{v.beforePhotos.map((ph,i)=><a key={i} href={ph.url} target="_blank" rel="noopener"><img src={ph.url} alt={ph.fileName || `before-${i}`} className="h-24 w-full object-cover rounded border hover:opacity-90" loading="lazy" /></a>)}</div></div> : null}
                    {v.afterPhotos?.length ? <div><p className="text-xs font-semibold mb-1">After Photos ({v.afterPhotos.length})</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{v.afterPhotos.map((ph,i)=><a key={i} href={ph.url} target="_blank" rel="noopener"><img src={ph.url} alt={ph.fileName || `after-${i}`} className="h-24 w-full object-cover rounded border hover:opacity-90" loading="lazy" /></a>)}</div></div> : null}
                  </div>
                ) : null}
                {(v.customerSignature || v.signatureReason) && (
                  <div>
                    <p className="text-xs font-semibold">Customer Sign-off</p>
                    <div className="mt-1 flex flex-col sm:flex-row gap-3 items-start">
                      {v.customerSignature?.url ? <a href={v.customerSignature.url} target="_blank" rel="noopener"><img src={v.customerSignature.url} alt="Customer signature" className="h-20 border rounded bg-white p-1" /></a> : <p className="text-xs text-muted-foreground">No signature captured</p>}
                      {v.signatureReason && <p className="text-xs"><span className="font-medium">Reason:</span> {v.signatureReason}</p>}
                    </div>
                  </div>
                )}
                {!v.problemFound && !v.diagnosis && !v.workDone && !v.beforePhotos?.length && !v.afterPhotos?.length && !v.customerSignature && <p className="text-xs text-muted-foreground">No detailed data entered yet for this visit.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Detail = {
  _id: string; callId: string; problemDescription: string; priority: string; currentStatus: string; nextAction?: string;
  complaintDate: string; complaintType: string; targetVisitDate?: string; targetResolutionDate?: string; actualVisitDate?: string; actualResolutionDate?: string;
  customer: { companyName: string; customerId: string }; site: { siteName: string; siteId: string }; equipment?: { equipmentId: string; _id: string };
  assignedEngineer?: { name: string; _id: string }; assignmentHistory?: { engineer: { name: string } | string; assignedAt: string; assignedBy?: { name: string }; reason?: string; visitId?: string }[]; createdBy?: { name: string }; createdAt: string;
  statusHistory: { status: string; date: string; updatedBy?: { name: string }; remarks?: string }[];
};

export default function ServiceCallDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [call, setCall] = useState<Detail | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);
  const [assignEngineer, setAssignEngineer] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [myRole, setMyRole] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);
  const [editPriority, setEditPriority] = useState("");
  const [editProblem, setEditProblem] = useState("");
  const [editTargetVisit, setEditTargetVisit] = useState("");
  const [editTargetResolution, setEditTargetResolution] = useState("");

  async function load() {
    const res = await fetch(`/api/service-calls/${id}`);
    if (res.ok) setCall(await res.json());
  }

  function openEdit() {
    if (!call) return;
    setEditPriority(call.priority);
    setEditProblem(call.problemDescription);
    setEditTargetVisit(call.targetVisitDate ? new Date(call.targetVisitDate).toISOString().slice(0,10) : "");
    setEditTargetResolution(call.targetResolutionDate ? new Date(call.targetResolutionDate).toISOString().slice(0,10) : "");
    setEditOpen(true);
  }
  async function handleEditSave() {
    const res = await fetch(`/api/service-calls/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: editPriority, problemDescription: editProblem, targetVisitDate: editTargetVisit || undefined, targetResolutionDate: editTargetResolution || undefined }) });
    if (res.ok) { setEditOpen(false); load(); } else alert("Edit failed: " + JSON.stringify(await res.json()));
  }
  async function handleDelete() {
    if (!confirm("Permanently delete this service call? This cannot be undone.")) return;
    const res = await fetch(`/api/service-calls/${id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/dashboard/service-calls";
    else alert("Delete failed: " + JSON.stringify(await res.json()));
  }
  useEffect(() => { load(); fetch("/api/engineers").then(async (r) => { if (r.ok) setEngineers((await r.json()).items); }); fetch("/api/auth/me").then(async (r) => { if (r.ok) { const j = await r.json(); setMyRole(j.user?.role || ""); } }); }, [id]);

  if (!call) return <div className="p-6 text-sm text-muted-foreground">Loading service call...</div>;

  const allowed = (STATUS_TRANSITIONS[call.currentStatus as never] as string[]) || [];
  const isOverdue = call.targetVisitDate ? new Date(call.targetVisitDate) < new Date() && !["CLOSED", "CANCELLED"].includes(call.currentStatus) : false;
  const allowedFiltered = myRole === "engineer" ? allowed.filter((s) => !["WORK_COMPLETED", "CUSTOMER_CONFIRMATION", "CLOSED"].includes(s)) : allowed;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">{call.callId} <PriorityBadge priority={call.priority} /> <StatusBadge status={call.currentStatus} /> {isOverdue && <Badge variant="destructive">OVERDUE</Badge>}</h1>
          <p className="text-sm text-muted-foreground">{call.customer.companyName} • {call.site.siteName} {call.equipment ? `• ${call.equipment.equipmentId}` : ""} • Next: {call.nextAction}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/service-calls"><Button variant="outline" size="sm">Back</Button></Link>
          <Link href={`/dashboard/service-calls/${id}/visit`}><Button variant="outline" size="sm">Add Visit</Button></Link>
          {allowed.includes("WORK_COMPLETED") && myRole !== "engineer" && (
            <Button size="sm" variant="secondary" onClick={async () => {
              const res = await fetch(`/api/service-calls/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "WORK_COMPLETED", remarks: "Work completed" }) });
              if (res.ok) load(); else alert("Failed: " + JSON.stringify(await res.json()));
            }}>Mark Work Completed</Button>
          )}
          {allowed.includes("CUSTOMER_CONFIRMATION") && myRole !== "engineer" && (
            <Button size="sm" variant="secondary" onClick={async () => {
              const res = await fetch(`/api/service-calls/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CUSTOMER_CONFIRMATION", remarks: "Customer confirmation" }) });
              if (res.ok) load(); else alert("Failed: " + JSON.stringify(await res.json()));
            }}>Customer Confirm</Button>
          )}
          {allowed.includes("CLOSED") && myRole !== "engineer" ? (
            <Button size="sm" variant="default" onClick={async () => {
              if (!confirm("Close this service call? This will set actualResolutionDate.")) return;
              const res = await fetch(`/api/service-calls/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CLOSED", remarks: "Closed" }) });
              if (res.ok) load(); else alert("Failed: " + JSON.stringify(await res.json()));
            }}>Close Call</Button>
          ) : allowed.includes("CANCELLED") && call.currentStatus !== "CLOSED" && call.currentStatus !== "CANCELLED" && myRole !== "engineer" ? (
            <Button size="sm" variant="destructive" onClick={async () => {
              if (!confirm("Cancel this call?")) return;
              const res = await fetch(`/api/service-calls/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", remarks: "Cancelled" }) });
              if (res.ok) load(); else alert("Failed: " + JSON.stringify(await res.json()));
            }}>Cancel Call</Button>
          ) : null}
          {allowedFiltered.includes("REOPENED") && (
            <Button size="sm" variant="outline" onClick={async () => {
              const res = await fetch(`/api/service-calls/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REOPENED", remarks: "Reopened" }) });
              if (res.ok) load(); else alert("Failed: " + JSON.stringify(await res.json()));
            }}>Reopen</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>Update Status</Button>
          <Button size="sm" variant="outline" onClick={openEdit} disabled={call.currentStatus === "CLOSED" || call.currentStatus === "CANCELLED"}>Edit</Button>
          {(myRole === "super_admin" || myRole === "manager") && <Button size="sm" variant="destructive" onClick={() => handleDelete()}>Delete</Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Complaint</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(call.complaintDate).toLocaleDateString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{call.complaintType}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><PriorityBadge priority={call.priority} /></div>
          <Separator />
          <p className="text-xs whitespace-pre-wrap">{call.problemDescription}</p>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Assignment & SLA</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Engineer</span><span>{call.assignedEngineer?.name || "Unassigned"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Target Visit</span><span className={isOverdue ? "text-destructive font-medium" : ""}>{call.targetVisitDate ? new Date(call.targetVisitDate).toLocaleDateString() : "-"} {isOverdue ? "• Overdue" : ""}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Actual Visit</span><span>{call.actualVisitDate ? new Date(call.actualVisitDate).toLocaleDateString() : "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Resolution Target</span><span>{call.targetResolutionDate ? new Date(call.targetResolutionDate).toLocaleDateString() : "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Actual Resolution</span><span>{call.actualResolutionDate ? new Date(call.actualResolutionDate).toLocaleDateString() : "-"}</span></div>
          <Separator />
          <div className="flex gap-2">
            <Select value={assignEngineer} onValueChange={(v) => setAssignEngineer(v as string)}><SelectTrigger className="flex-1"><SelectValue placeholder="Assign engineer" /></SelectTrigger><SelectContent>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select>
            <Button size="sm" disabled={!assignEngineer} onClick={async () => {
              const res = await fetch(`/api/service-calls/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedEngineer: assignEngineer }) });
              if (res.ok) { setAssignEngineer(""); load(); } else alert("Assign failed");
            }}>Assign</Button>
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Next Action</CardTitle><CardDescription>Pending since {new Date(call.createdAt).toLocaleDateString()}</CardDescription></CardHeader><CardContent className="space-y-3">
          <p className="text-sm font-medium">{call.nextAction}</p>
          <p className="text-xs text-muted-foreground">Status: {call.currentStatus} • Created by {call.createdBy?.name || "-"}</p>
          {(call.currentStatus === "WORK_COMPLETED" || call.currentStatus === "CUSTOMER_CONFIRMATION") && myRole !== "engineer" && (
            <div className="border rounded-md p-3 space-y-2">
              <p className="text-xs font-medium">Customer OTP Closure (Option A — signature primary, OTP for Close)</p>
              <p className="text-xs text-muted-foreground">Work completed via Visit signature → OTP sent to customer email → verify → CLOSED. Super_admin/manager/coordinator can request/verify.</p>
              <div className="flex gap-2">
                <Button size="xs" variant="outline" onClick={async () => {
                  const res = await fetch(`/api/service-calls/${id}/request-closure-otp`, { method: "POST" });
                  const j = await res.json();
                  if (res.ok) { setOtpSent(true); } else alert("Failed: " + JSON.stringify(j));
                }}>Request Closure OTP</Button>
                <Input placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-[140px]" />
                <Button size="xs" disabled={!otp} onClick={async () => {
                  const res = await fetch(`/api/service-calls/${id}/verify-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otp }) });
                  const j = await res.json();
                  if (res.ok) { alert(`Verified → ${j.status}`); setOtp(""); setOtpSent(false); load(); } else alert("Failed: " + JSON.stringify(j));
                }}>Verify & Close</Button>
              </div>
              {otpSent && <p className="text-xs text-green-600">✓ OTP sent (10m expiry, 3 attempts)</p>}
            </div>
          )}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-sm">Financial Summary</CardTitle><CardDescription>Approved expenses • service cost derived from source records</CardDescription></CardHeader><CardContent><FinanceSummary serviceCallId={id} /></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Visits — Multiple per Call with Different Engineers</CardTitle><CardDescription>Purpose • GPS • diagnosis • Each visit independent NOT_STARTED→IN_PROGRESS→COMPLETED</CardDescription></CardHeader><CardContent><VisitsList id={id} /></CardContent></Card>

      {call.assignmentHistory && call.assignmentHistory.length > 0 && (
        <Card><CardHeader><CardTitle className="text-sm">Assignment History</CardTitle><CardDescription>Engineer A→B→A preserved, not overwritten</CardDescription></CardHeader><CardContent className="space-y-2">
          {call.assignmentHistory.map((h, i) => (
            <div key={i} className="flex justify-between text-xs border-b py-2">
              <span>{typeof h.engineer === "object" ? (h.engineer as { name: string }).name : h.engineer} {h.visitId ? `• ${h.visitId}` : ""}</span>
              <span className="text-muted-foreground">{new Date(h.assignedAt).toLocaleDateString()} {h.reason ? `• ${h.reason}` : ""}</span>
            </div>
          ))}
        </CardContent></Card>
      )}

      <Card><CardHeader><CardTitle className="text-sm">Status Timeline</CardTitle><CardDescription>Every status change is validated server-side via isValidTransition — preserved domain history</CardDescription></CardHeader><CardContent>
        <div className="space-y-3">
          {call.statusHistory.map((h, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${i === call.statusHistory.length - 1 ? "bg-primary" : "bg-muted-foreground"}`} />
                {i < call.statusHistory.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2"><Badge variant="outline">{h.status}</Badge><span className="text-xs text-muted-foreground">{new Date(h.date).toLocaleString()}</span><span className="text-xs">{h.updatedBy?.name ? `by ${h.updatedBy.name}` : ""}</span></div>
                {h.remarks && <p className="text-xs mt-1">{h.remarks}</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>

      {/* AUDIT TIMELINE TEMPORARILY HIDDEN — not deleted, just commented/hidden per request */}
      {/* <ActivityTimeline serviceCallId={id} /> */}

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Status</DialogTitle><CardDescription>Valid transitions from {call.currentStatus}: {(myRole === "engineer" ? allowedFiltered : allowed).join(", ") || "none"} {myRole === "engineer" && <span className="text-xs">• WORK_COMPLETED/CLOSED hidden for engineer</span>}</CardDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">New Status</label><Select value={newStatus} onValueChange={(v) => setNewStatus(v as string)}><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent>{(myRole === "engineer" ? allowedFiltered : allowed).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-sm font-medium">Remarks</label><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for change..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button
              disabled={!newStatus}
              onClick={async () => {
                const res = await fetch(`/api/service-calls/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus, remarks }) });
                if (res.ok) { setStatusOpen(false); setNewStatus(""); setRemarks(""); load(); }
                else alert("Failed: " + JSON.stringify(await res.json()));
              }}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Service Call</DialogTitle><CardDescription>Update priority, problem description, and target dates. Customer/site/equipment remain immutable.</CardDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Priority</label><Select value={editPriority} onValueChange={(v) => setEditPriority(v as string)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CRITICAL">CRITICAL</SelectItem><SelectItem value="HIGH">HIGH</SelectItem><SelectItem value="MEDIUM">MEDIUM</SelectItem><SelectItem value="LOW">LOW</SelectItem></SelectContent></Select></div>
            <div><label className="text-sm font-medium">Problem Description</label><Textarea value={editProblem} onChange={(e) => setEditProblem(e.target.value)} placeholder="Describe problem..." /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Target Visit Date</label><Input type="date" value={editTargetVisit} onChange={(e) => setEditTargetVisit(e.target.value)} /></div><div><label className="text-sm font-medium">Target Resolution Date</label><Input type="date" value={editTargetResolution} onChange={(e) => setEditTargetResolution(e.target.value)} /></div></div>
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
