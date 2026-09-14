"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppAlert } from "@/components/common/alert-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { QrPrintActions } from "@/components/equipment/qr-print-actions";

type Eq = {
  _id: string;
  equipmentId: string;
  assetId?: string;
  customer: { companyName: string; customerId: string };
  site: { siteName: string; siteId: string };
  make?: string; model?: string; serialNumber?: string; kvaCapacity?: string;
  equipmentType?: string; equipmentStatus: string; currentCondition?: string;
  installationDate?: string; warrantyStartDate?: string; warrantyEndDate?: string;
  amcStartDate?: string; amcEndDate?: string;
  batteryMake?: string; batteryModel?: string; batteryQuantity?: number; batteryCapacity?: string; batteryInstallationDate?: string;
  qrToken?: string; remarks?: string;
};

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showAlert } = useAppAlert();
  const id = params.id;
  const [eq, setEq] = useState<Eq | null>(null);
  const [movements, setMovements] = useState<{ _id: string; fromSite?: { siteName: string }; toSite: { siteName: string }; date: string; reason?: string; remarks?: string }[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [sites, setSites] = useState<{ _id: string; siteName: string; customer: string }[]>([]);
  const [transferCustomer, setTransferCustomer] = useState("");
  const [transferSite, setTransferSite] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferRemarks, setTransferRemarks] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentAmc, setCurrentAmc] = useState<{ amcId: string; amcType: string; startDate: string; endDate: string; status: string } | null>(null);
  const [serviceHistory, setServiceHistory] = useState<{ _id: string; callId: string; currentStatus: string; priority: string; createdAt: string }[]>([]);

  useEffect(() => {
    fetch(`/api/equipment/${id}`).then(async (r) => { if (r.ok) setEq(await r.json()); });
    fetch(`/api/equipment/${id}/movements`).then(async (r) => { if (r.ok) { const d = await r.json(); setMovements(d.items); } });
    // Load current AMC for this equipment
    fetch(`/api/amc?limit=100`).then(async (r) => { if (r.ok) { const d = await r.json(); const amcs = d.items as { equipmentIds: { _id: string }[]; amcId: string; amcType: string; startDate: string; endDate: string; status: string }[]; const found = amcs.find((a) => a.equipmentIds.some((e) => String(e._id) === id)); if (found) setCurrentAmc(found); } });
    fetch("/api/customers?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setCustomers(d.items); } });
    fetch("/api/sites?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setSites(d.items); } });
    fetch(`/api/service-calls?equipment=${id}&limit=100`).then(async (r) => { if (r.ok) { const d = await r.json(); setServiceHistory(d.items); } });
  }, [id]);

  useEffect(() => {
    if (eq?.qrToken) {
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/equipment/qr/${eq.qrToken}`;
      import("qrcode").then((QR) => QR.toDataURL(url, { width: 180, margin: 1 }).then(setQrDataUrl));
    }
  }, [eq]);

  if (!eq) return <div className="p-6 text-sm text-muted-foreground">Loading equipment...</div>;

  const warrantyExpired = eq.warrantyEndDate ? new Date(eq.warrantyEndDate) < new Date() : null;
  const amcExpired = eq.amcEndDate ? new Date(eq.amcEndDate) < new Date() : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{eq.equipmentId}</h1>
          <p className="text-sm text-muted-foreground">{[eq.make, eq.model].filter(Boolean).join(" ")} • {eq.kvaCapacity || "UPS"} • {eq.serialNumber || "No serial"}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={eq.equipmentStatus === "ACTIVE" ? "default" : "secondary"}>{eq.equipmentStatus}</Badge>
          {eq.currentCondition && <Badge variant="outline">{eq.currentCondition}</Badge>}
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>Transfer</Button>
          <Link href="/dashboard/equipment"><Button variant="outline" size="sm">Back</Button></Link>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="battery">Battery</TabsTrigger>
          <TabsTrigger value="warranty">Warranty & AMC</TabsTrigger>
          <TabsTrigger value="movement">Movement</TabsTrigger>
          <TabsTrigger value="service">Service History</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-sm">Equipment</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Equipment ID</span><span className="font-mono font-medium">{eq.equipmentId}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Asset ID</span><span className="font-mono">{eq.assetId || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{eq.equipmentType || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Make/Model</span><span>{[eq.make, eq.model].filter(Boolean).join(" ") || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Serial</span><span className="font-mono text-xs">{eq.serialNumber || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">KVA</span><span>{eq.kvaCapacity || "-"}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{eq.customer?.companyName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Site</span><span>{eq.site?.siteName}</span></div>
              {eq.remarks && <p className="text-xs text-muted-foreground pt-2">{eq.remarks}</p>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Status & Condition</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge>{eq.equipmentStatus}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Condition</span><span>{eq.currentCondition || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Installation</span><span>{eq.installationDate ? new Date(eq.installationDate).toLocaleDateString() : "-"}</span></div>
              <Separator />
              <p className="text-xs text-muted-foreground">Equipment ID is immutable. Transfers create movement history, not new records.</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="battery" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Battery Details</CardTitle><CardDescription>Quantity, capacity, installation</CardDescription></CardHeader><CardContent className="text-sm grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground text-xs">Make</span><p>{eq.batteryMake || "-"}</p></div>
            <div><span className="text-muted-foreground text-xs">Model</span><p>{eq.batteryModel || "-"}</p></div>
            <div><span className="text-muted-foreground text-xs">Quantity</span><p>{eq.batteryQuantity ?? "-"}</p></div>
            <div><span className="text-muted-foreground text-xs">Capacity</span><p>{eq.batteryCapacity || "-"}</p></div>
            <div><span className="text-muted-foreground text-xs">Installation Date</span><p>{eq.batteryInstallationDate ? new Date(eq.batteryInstallationDate).toLocaleDateString() : "-"}</p></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="warranty" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-sm">Warranty</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{eq.warrantyStartDate ? new Date(eq.warrantyStartDate).toLocaleDateString() : "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End</span><span className="flex items-center gap-2">{eq.warrantyEndDate ? new Date(eq.warrantyEndDate).toLocaleDateString() : "-"} {warrantyExpired === true && <Badge variant="destructive">Expired</Badge>}{warrantyExpired === false && <Badge variant="secondary">Active</Badge>}</span></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Current AMC</CardTitle><CardDescription>{currentAmc ? `${currentAmc.amcId} • ${currentAmc.amcType}` : "No active AMC"}</CardDescription></CardHeader><CardContent className="text-sm space-y-2">
              {currentAmc ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">AMC ID</span><span className="font-mono text-xs">{currentAmc.amcId}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{currentAmc.amcType}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{new Date(currentAmc.startDate).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{new Date(currentAmc.endDate).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge>{currentAmc.status}</Badge></div>
                  <Link href={`/dashboard/amc`}><Button variant="outline" size="sm" className="w-full mt-2">View AMC</Button></Link>
                </>
              ) : (
                <p className="text-muted-foreground">No active AMC for this equipment. Create via AMC module.</p>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="movement" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Movement History</CardTitle><CardDescription>{eq.equipmentId} transfers</CardDescription></CardHeader><CardContent>
            {movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements yet. Transfer via edit keeps equipmentId immutable.</p> : (
              <div className="space-y-3">
                {movements.map((m) => (
                  <div key={m._id} className="flex justify-between border-b py-2 text-sm">
                    <div><p className="font-medium">{m.fromSite?.siteName || "—"} → {m.toSite.siteName}</p><p className="text-xs text-muted-foreground">{m.reason} • {new Date(m.date).toLocaleDateString()} {m.remarks ? `• ${m.remarks}` : ""}</p></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Service History</CardTitle><CardDescription>{eq.equipmentId} complaints</CardDescription></CardHeader><CardContent>
            {serviceHistory.length === 0 ? <p className="text-sm text-muted-foreground">No service calls for this equipment yet.</p> : (
              <div className="space-y-2">
                {serviceHistory.map((s) => (
                  <div key={s._id} className="flex justify-between border-b py-2 text-sm cursor-pointer" onClick={() => window.location.href = `/dashboard/service-calls/${s._id}`}>
                    <span className="font-mono text-xs">{s.callId}</span><span className="text-xs">{s.currentStatus}</span><Badge variant="outline">{s.priority}</Badge><span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">QR Code</CardTitle>
              <CardDescription>Secure token — no Mongo ObjectId exposed • /equipment/qr/{eq.qrToken}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="border rounded-lg p-2 bg-white" /> : <p className="text-sm text-muted-foreground">Generating...</p>}
              <p className="font-mono text-xs break-all">{eq.qrToken}</p>
              <p className="font-mono text-xs font-semibold">{eq.equipmentId} {eq.assetId ? `• ${eq.assetId}` : ""}</p>
              {qrDataUrl && (
                <QrPrintActions
                  qrDataUrl={qrDataUrl}
                  equipmentId={eq.equipmentId}
                  assetId={eq.assetId}
                  serialNumber={eq.serialNumber}
                  token={eq.qrToken || ""}
                  make={eq.make}
                  model={eq.model}
                  siteName={eq.site?.siteName}
                />
              )}
              <a href={`/equipment/qr/${eq.qrToken}`} target="_blank" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Open QR page
                </Button>
              </a>
              <p className="text-[11px] text-muted-foreground text-center">Print the label and affix to equipment. Scanning opens the safe public QR page.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Equipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>New Customer</Label><Select value={transferCustomer} onValueChange={(v) => { setTransferCustomer(v as string); setTransferSite(""); }}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>New Site</Label><Select value={transferSite} onValueChange={(v) => setTransferSite(v as string)}><SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger><SelectContent>{sites.filter((s) => String((s as unknown as { customer: string }).customer) === transferCustomer || (s.customer as unknown as { _id: string })?._id === transferCustomer).map((s) => <SelectItem key={s._id} value={s._id}>{s.siteName}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Movement Date</Label><Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} /></div>
            <div><Label>Reason</Label><Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="e.g. Site relocation" /></div>
            <div><Label>Remarks</Label><Textarea value={transferRemarks} onChange={(e) => setTransferRemarks(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!transferSite) { await showAlert("Select site", "Error"); return; }
                const res = await fetch(`/api/equipment/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ site: transferSite, reason: transferReason, remarks: transferRemarks }),
                });
                if (res.ok) { setTransferOpen(false); router.refresh(); window.location.reload(); } else await showAlert("Transfer failed: " + JSON.stringify(await res.json()), "Error");
              }}
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
