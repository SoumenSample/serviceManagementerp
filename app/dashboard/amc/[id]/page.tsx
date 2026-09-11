"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AmcStatusBadge, PaymentStatusBadge, AmcTypeBadge, DaysRemainingBadge } from "@/components/amc/amc-badges";

type AmcDetail = {
  _id: string; amcId: string; amcType: string; startDate: string; endDate: string; contractAmount: number; paymentStatus: string; status: string; computedStatus: string; daysRemaining: number; terms?: string;
  customer: { companyName: string; customerId: string; contactPerson?: string; mobile?: string; email?: string; billingAddress?: string };
  site: { siteName: string; siteId: string; siteAddress?: string; city?: string; state?: string; contactPerson?: string };
  equipmentIds: { _id: string; equipmentId: string; assetId?: string; make?: string; model?: string; serialNumber?: string; kvaCapacity?: string; equipmentStatus: string }[];
  assignedEngineer?: { name: string; email: string };
  renewalHistory: { previousAmcId: string; newAmcId: string; renewalDate: string; previousEndDate?: string; newStartDate: string; newEndDate: string; remarks?: string }[];
  documents: { url: string; fileName: string }[];
};

export default function AmcDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [amc, setAmc] = useState<AmcDetail | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewStart, setRenewStart] = useState("");
  const [renewEnd, setRenewEnd] = useState("");
  const [renewAmount, setRenewAmount] = useState("");
  const [renewRemarks, setRenewRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/amc/${id}`);
    if (res.ok) setAmc(await res.json());
  }
  useEffect(() => { load(); }, [id]);

  if (!amc) return <div className="p-6 text-sm text-muted-foreground">Loading AMC...</div>;
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{amc.amcId}</h1>
          <p className="text-sm text-muted-foreground">{amc.customer.companyName} • {amc.site.siteName}</p>
        </div>
        <div className="flex gap-2">
          <AmcStatusBadge startDate={amc.startDate} endDate={amc.endDate} storedStatus={amc.status} />
          <Link href="/dashboard/amc"><Button variant="outline" size="sm">Back</Button></Link>
          <Link href={`/dashboard/amc/${amc._id}/edit`}><Button variant="outline" size="sm">Edit</Button></Link>
          <Button size="sm" onClick={() => setRenewOpen(true)}>Renew AMC</Button>
          <Button
            variant="destructive" size="sm"
            onClick={async () => {
              if (!confirm("Cancel this AMC? (soft cancel, preserves history)")) return;
              const res = await fetch(`/api/amc/${amc._id}`, { method: "DELETE" });
              if (res.ok) { alert("Cancelled"); load(); } else alert("Failed");
            }}
          >
            Cancel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Contract</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">AMC ID</span><span className="font-mono text-xs">{amc.amcId}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><AmcTypeBadge type={amc.amcType} /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{new Date(amc.startDate).toLocaleDateString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{new Date(amc.endDate).toLocaleDateString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Days Remaining</span><DaysRemainingBadge startDate={amc.startDate} endDate={amc.endDate} storedStatus={amc.status} /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{inr(amc.contractAmount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><PaymentStatusBadge status={amc.paymentStatus} /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Engineer</span><span>{amc.assignedEngineer?.name || "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stored Status</span><Badge variant="outline">{amc.status}</Badge></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
          <p className="font-medium">{amc.customer.companyName} <span className="font-mono text-xs text-muted-foreground">{amc.customer.customerId}</span></p>
          <p>{amc.customer.contactPerson || "-"}</p><p>{amc.customer.mobile || "-"} • {amc.customer.email || "-"}</p><p className="text-xs text-muted-foreground">{amc.customer.billingAddress || "-"}</p>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Site</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
          <p className="font-medium">{amc.site.siteName} <span className="font-mono text-xs text-muted-foreground">{amc.site.siteId}</span></p>
          <p>{amc.site.siteAddress || "-"}</p><p>{amc.site.city || "-"} {amc.site.state || ""}</p><p>{amc.site.contactPerson || "-"}</p>
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-sm">Covered Equipment ({amc.equipmentIds.length})</CardTitle><CardDescription>Each row links to equipment detail</CardDescription></CardHeader><CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Equipment ID</TableHead><TableHead>Asset ID</TableHead><TableHead>Make</TableHead><TableHead>Model</TableHead><TableHead>Serial</TableHead><TableHead>Capacity</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{amc.equipmentIds.map((e) => (
            <TableRow key={e._id} className="cursor-pointer" onClick={() => window.location.href = `/dashboard/equipment/${e._id}`}>
              <TableCell className="font-mono text-xs">{e.equipmentId}</TableCell><TableCell className="font-mono text-xs">{e.assetId || "-"}</TableCell><TableCell>{e.make || "-"}</TableCell><TableCell>{e.model || "-"}</TableCell><TableCell className="font-mono text-xs">{e.serialNumber || "-"}</TableCell><TableCell>{e.kvaCapacity || "-"}</TableCell><TableCell><Badge variant="outline">{e.equipmentStatus}</Badge></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CardContent></Card>

      {amc.terms && <Card><CardHeader><CardTitle className="text-sm">Terms</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{amc.terms}</p></CardContent></Card>}

      <Card><CardHeader><CardTitle className="text-sm">Documents</CardTitle><CardDescription>Folder /ups-system/amc/{amc.amcId}/ — PDF/JPG/PNG/WEBP, max 5MB (future upload)</CardDescription></CardHeader><CardContent>{amc.documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents yet.</p> : amc.documents.map((d, i) => <a key={i} href={d.url} target="_blank" className="text-sm underline">{d.fileName}</a>)}</CardContent></Card>

      <Card><CardHeader><CardTitle className="text-sm">Renewal History</CardTitle><CardDescription>Old AMC remains — never destroyed on renewal</CardDescription></CardHeader><CardContent>
        {amc.renewalHistory.length === 0 ? <p className="text-sm text-muted-foreground">No renewals yet.</p> : (
          <div className="space-y-2">
            {amc.renewalHistory.map((r, i) => (
              <div key={i} className="border rounded-md p-3 text-sm">
                <p className="font-mono text-xs">{r.previousAmcId} → {r.newAmcId}</p>
                <p className="text-xs text-muted-foreground">Renewed {new Date(r.renewalDate).toLocaleDateString()} • Prev End {r.previousEndDate ? new Date(r.previousEndDate).toLocaleDateString() : "-"} → New {new Date(r.newStartDate).toLocaleDateString()} - {new Date(r.newEndDate).toLocaleDateString()} {r.remarks ? `• ${r.remarks}` : ""}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renew AMC</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>New Start Date *</Label><Input type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} /></div>
              <div><Label>New End Date *</Label><Input type="date" value={renewEnd} onChange={(e) => setRenewEnd(e.target.value)} /></div>
            </div>
            <div><Label>Contract Amount (INR)</Label><Input type="number" value={renewAmount} onChange={(e) => setRenewAmount(e.target.value)} placeholder={String(amc.contractAmount)} /></div>
            <div><Label>Remarks</Label><Textarea value={renewRemarks} onChange={(e) => setRenewRemarks(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancel</Button>
            <Button
              disabled={loading}
              onClick={async () => {
                if (!renewStart || !renewEnd) return alert("Dates required");
                setLoading(true);
                const res = await fetch(`/api/amc/${amc._id}/renew`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ newStartDate: renewStart, newEndDate: renewEnd, contractAmount: renewAmount ? Number(renewAmount) : undefined, remarks: renewRemarks }),
                });
                setLoading(false);
                if (res.ok) {
                  const d = await res.json();
                  alert(`Renewed: ${d.newAmc.amcId}`);
                  setRenewOpen(false);
                  router.push(`/dashboard/amc/${d.newAmc._id}`);
                } else alert("Renew failed: " + JSON.stringify(await res.json()));
              }}
            >
              {loading ? "Renewing..." : "Create Renewal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
