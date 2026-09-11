"use client";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { visitSchema } from "@/lib/validators";
import { SignaturePad } from "@/components/visits/signature-pad";
import { PhotoUploader } from "@/components/visits/photo-uploader";

type Visit = { _id: string; visitId: string; status: string; startedAt?: string; completedAt?: string; gpsLatitude?: number; visitDate: string; customerSignature?: { url: string } };

export default function VisitWorkflowPage() {
  const params = useParams<{ id: string }>();
  const serviceCallId = params.id;
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selected, setSelected] = useState<Visit | null>(null);
  const [gps, setGps] = useState<{ lat?: number; lng?: number; acc?: number; err?: string; loading?: boolean }>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [sigReason, setSigReason] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<{ url: string; publicId: string }[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<{ url: string; publicId: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState<{ _id: string; partNumber: string; name: string }[]>([]);
  const [partRequests, setPartRequests] = useState<{ _id: string; requestId: string; status: string; part: { partNumber: string }; quantity: number }[]>([]);
  const [selectedPart, setSelectedPart] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partRemarks, setPartRemarks] = useState("");
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);
  const [visitEngineer, setVisitEngineer] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("OTHER");

  const form = useForm<any>({
    resolver: zodResolver(visitSchema),
    defaultValues: { visitDate: new Date().toISOString().slice(0, 10), visitTime: new Date().toTimeString().slice(0, 5), equipmentCondition: "GOOD", visitPurpose: "OTHER" },
  });

  async function loadVisits() {
    const res = await fetch(`/api/service-calls/${serviceCallId}/visits`);
    if (res.ok) {
      const d = await res.json();
      setVisits(d.items);
      // Only auto-select first visit on initial load, not when user explicitly clicked New Visit
      if (d.items.length && !selected && visits.length === 0) setSelected(d.items[0]);
    }
  }
  async function loadParts() {
    const res = await fetch("/api/parts?limit=100");
    if (res.ok) setParts((await res.json()).items);
  }
  async function loadEngineers() {
    const res = await fetch("/api/engineers");
    if (res.ok) setEngineers((await res.json()).items);
  }
  async function loadPartRequests() {
    if (!selected) return;
    const res = await fetch(`/api/part-requests?limit=100`);
    if (res.ok) { const d = await res.json(); setPartRequests(d.items.filter((r: { serviceVisit: string | { _id: string } }) => String(typeof r.serviceVisit === "object" ? (r.serviceVisit as { _id: string })._id : r.serviceVisit) === String(selected._id))); }
  }
  useEffect(() => { loadVisits(); loadParts(); loadEngineers(); }, [serviceCallId]);
  useEffect(() => { loadPartRequests(); }, [selected]);

  function captureGps(kind: "start" | "complete") {
    if (!navigator.geolocation) { setGps({ err: "Browser does not support geolocation" }); return; }
    setGps({ loading: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      (err) => {
        if (err.code === 1) setGps({ err: "Location permission denied" });
        else if (err.code === 2) setGps({ err: "Unable to determine location" });
        else if (err.code === 3) setGps({ err: "Location request timed out" });
        else setGps({ err: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function createVisit() {
    const values = form.getValues();
    setLoading(true);
    const payload: Record<string, unknown> = { ...values, visitDate: values.visitDate, visitPurpose, engineer: visitEngineer || undefined };
    const res = await fetch(`/api/service-calls/${serviceCallId}/visits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setLoading(false);
    if (res.ok) { const doc = await res.json(); setSelected(doc); loadVisits(); alert(`Visit ${doc.visitId} (${doc.visitPurpose || visitPurpose}) created as NOT_STARTED`); } else alert("Create failed: " + JSON.stringify(await res.json()));
  }

  async function startVisit() {
    if (!selected) return;
    if (!gps.lat || !gps.lng) return alert("Capture start GPS first");
    setLoading(true);
    const res = await fetch(`/api/service-visits/${selected._id}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gpsLatitude: gps.lat, gpsLongitude: gps.lng, gpsAccuracy: gps.acc, gpsTimestamp: new Date().toISOString() }) });
    setLoading(false);
    if (res.ok) { const doc = await res.json(); setSelected(doc); loadVisits(); } else alert("Start failed: " + JSON.stringify(await res.json()));
  }

  async function completeVisit() {
    if (!selected) return;
    if (!signature && !sigReason) return alert("Signature or reason required");
    setLoading(true);
    const payload: Record<string, unknown> = {
      completionLatitude: gps.lat,
      completionLongitude: gps.lng,
      completionGpsAccuracy: gps.acc,
      diagnosis: form.getValues("diagnosis"),
      workDone: form.getValues("workDone"),
      problemFound: form.getValues("problemFound"),
      equipmentCondition: form.getValues("equipmentCondition"),
      engineerRemarks: form.getValues("engineerRemarks"),
      beforePhotos: beforePhotos.length ? beforePhotos : undefined,
      afterPhotos: afterPhotos.length ? afterPhotos : undefined,
      customerSignature: signature ? { url: signature, publicId: `sig-${Date.now()}` } : undefined,
      signatureReason: sigReason || undefined,
    };
    const res = await fetch(`/api/service-visits/${selected._id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setLoading(false);
    if (res.ok) { const doc = await res.json(); setSelected(doc); loadVisits(); alert("Visit COMPLETED"); } else alert("Complete failed: " + JSON.stringify(await res.json()));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-lg">Service Visit Workflow</CardTitle><CardDescription>SC → NOT_STARTED → Start Visit (GPS) → IN_PROGRESS → Complete Visit (GPS + Signature + Photos) → COMPLETED</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {selected && (
            <div className="border rounded-md p-3 space-y-1 text-sm">
              <p className="font-mono font-medium">{selected.visitId} <Badge variant={selected.status === "COMPLETED" ? "secondary" : selected.status === "IN_PROGRESS" ? "default" : "outline"}>{selected.status}</Badge></p>
              {selected.status === "NOT_STARTED" && <p className="text-muted-foreground">Visit Status NOT STARTED — [ Start Visit ]</p>}
              {selected.status === "IN_PROGRESS" && <p className="text-muted-foreground">IN PROGRESS • Started {selected.startedAt ? new Date(selected.startedAt).toLocaleString() : ""} • Start GPS {selected.gpsLatitude ? "✓" : gps.lat ? "✓" : "—"}</p>}
              {selected.status === "COMPLETED" && <p className="text-muted-foreground">COMPLETED • Started {selected.startedAt ? new Date(selected.startedAt).toLocaleString() : ""} • Completed {selected.completedAt ? new Date(selected.completedAt).toLocaleString() : ""} • Signature {selected.customerSignature ? "✓" : "—"}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <Select value={selected?._id || ""} onValueChange={(v) => setSelected(visits.find((x) => x._id === v) || null)}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select visit" /></SelectTrigger>
              <SelectContent>{visits.map((v) => <SelectItem key={v._id} value={v._id}>{v.visitId} • {v.status} • {new Date(v.visitDate).toLocaleDateString()}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadVisits}>Refresh</Button>
            <Button size="sm" onClick={() => setSelected(null)}>New Visit</Button>
          </div>

          {!selected && (
            <div className="space-y-4">
              <h3 className="font-medium">Create / Schedule Visit (NOT_STARTED)</h3>
              <Form {...form}>
                <form className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="visitDate" render={({ field }) => (<FormItem><FormLabel>Visit Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="visitTime" render={({ field }) => (<FormItem><FormLabel>Visit Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-sm font-medium">Purpose</label><Select value={visitPurpose} onValueChange={(v) => setVisitPurpose(v as string)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INITIAL_INSPECTION">INITIAL_INSPECTION</SelectItem><SelectItem value="DIAGNOSIS">DIAGNOSIS</SelectItem><SelectItem value="FOLLOW_UP_REPAIR">FOLLOW_UP_REPAIR</SelectItem><SelectItem value="PARTS_INSTALLATION">PARTS_INSTALLATION</SelectItem><SelectItem value="TESTING">TESTING</SelectItem><SelectItem value="FINAL_INSTALLATION">FINAL_INSTALLATION</SelectItem><SelectItem value="SERVICE_CENTER_REPAIR">SERVICE_CENTER_REPAIR</SelectItem><SelectItem value="RETURN_REINSTALLATION">RETURN_REINSTALLATION</SelectItem><SelectItem value="OTHER">OTHER</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Assign Engineer</label><Select value={visitEngineer} onValueChange={(v) => setVisitEngineer(v as string)}><SelectTrigger><SelectValue placeholder="Auto (assigned engineer)" /></SelectTrigger><SelectContent>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <Button type="button" disabled={loading} onClick={createVisit}>{loading ? "Creating..." : "Create Visit (NOT_STARTED)"}</Button>
                </form>
              </Form>
            </div>
          )}

          {selected?.status === "NOT_STARTED" && (
            <div className="space-y-3 border rounded-md p-3">
              <p className="text-sm font-medium">Start Visit — capture Start GPS (server startedAt)</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => captureGps("start")}>Capture Start GPS</Button>
                {gps.loading && <span className="text-xs text-muted-foreground">Requesting location...</span>}
                {gps.lat && <span className="text-xs text-green-600">✓ Location captured {gps.lat.toFixed(5)},{gps.lng?.toFixed(5)} ±{gps.acc?.toFixed(0)}m</span>}
                {gps.err && <span className="text-xs text-destructive">{gps.err}</span>}
              </div>
              <Button disabled={loading || !gps.lat} onClick={startVisit}>{loading ? "Starting..." : "Start Visit → IN_PROGRESS"}</Button>
            </div>
          )}

          {selected?.status === "IN_PROGRESS" && (
            <div className="space-y-4 border rounded-md p-3">
              <p className="text-sm font-medium">Complete Visit — work, photos, signature, completion GPS</p>
              <Form {...form}>
                <form className="space-y-3">
                  <FormField control={form.control} name="problemFound" render={({ field }) => (<FormItem><FormLabel>Problem Found</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="diagnosis" render={({ field }) => (<FormItem><FormLabel>Diagnosis</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="workDone" render={({ field }) => (<FormItem><FormLabel>Work Done</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="equipmentCondition" render={({ field }) => (<FormItem><FormLabel>Equipment Condition</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="GOOD">GOOD</SelectItem><SelectItem value="FAIR">FAIR</SelectItem><SelectItem value="POOR">POOR</SelectItem><SelectItem value="NOT_WORKING">NOT_WORKING</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="engineerRemarks" render={({ field }) => (<FormItem><FormLabel>Engineer Remarks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                </form>
              </Form>

              <PhotoUploader label="Before Photos" folder={`ups-system/service-calls/${serviceCallId}/${selected.visitId}/before`} onUploaded={(m) => setBeforePhotos((p) => [...p, m])} />
              {beforePhotos.length > 0 && <p className="text-xs text-green-600">✓ {beforePhotos.length} before photo(s) uploaded</p>}
              <PhotoUploader label="After Photos" folder={`ups-system/service-calls/${serviceCallId}/${selected.visitId}/after`} onUploaded={(m) => setAfterPhotos((p) => [...p, m])} />
              {afterPhotos.length > 0 && <p className="text-xs text-green-600">✓ {afterPhotos.length} after photo(s) uploaded</p>}

              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">Parts Required — PartRequest authoritative (no inventory deduction yet)</p>
                <div className="flex gap-2 flex-wrap">
                  <Select value={selectedPart} onValueChange={(v) => setSelectedPart(v as string)}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Select part" /></SelectTrigger><SelectContent>{parts.map((p) => <SelectItem key={p._id} value={p._id}>{p.partNumber} • {p.name}</SelectItem>)}</SelectContent></Select>
                  <Input type="number" placeholder="Qty" value={partQty} onChange={(e) => setPartQty(e.target.value)} className="w-[80px]" />
                  <Input placeholder="Remarks" value={partRemarks} onChange={(e) => setPartRemarks(e.target.value)} className="flex-1" />
                  <Button type="button" size="sm" disabled={!selectedPart || !partQty} onClick={async () => {
                    const res = await fetch("/api/part-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ part: selectedPart, quantity: Number(partQty), serviceCall: serviceCallId, serviceVisit: selected._id, remarks: partRemarks }) });
                    if (res.ok) { setPartQty("1"); setPartRemarks(""); loadPartRequests(); alert("Part request REQUIRED created"); } else alert("Failed: " + JSON.stringify(await res.json()));
                  }}>Add Part</Button>
                </div>
                {partRequests.length > 0 && <div className="space-y-1">{partRequests.map((pr) => <div key={pr._id} className="flex justify-between text-xs border rounded p-2"><span className="font-mono">{pr.requestId} • {pr.part.partNumber} ×{pr.quantity}</span><Badge variant="outline">{pr.status}</Badge></div>)}</div>}
              </div>

              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">Customer Signature → /ups-system/signatures/{serviceCallId}/</p>
                <SignaturePad onSave={setSignature} />
                {signature && <p className="text-xs text-green-600">✓ Signature captured</p>}
                <Select value={sigReason} onValueChange={(v) => setSigReason(v as string)}><SelectTrigger><SelectValue placeholder="Or reason if no signature" /></SelectTrigger><SelectContent><SelectItem value="CUSTOMER_UNAVAILABLE">CUSTOMER_UNAVAILABLE</SelectItem><SelectItem value="CUSTOMER_REFUSED">CUSTOMER_REFUSED</SelectItem><SelectItem value="SITE_CLOSED">SITE_CLOSED</SelectItem><SelectItem value="OTHER">OTHER</SelectItem></SelectContent></Select>
              </div>

              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">Completion GPS</p>
                <Button type="button" variant="outline" size="sm" onClick={() => captureGps("complete")}>Capture Completion GPS</Button>
                {gps.lat && <span className="text-xs text-muted-foreground ml-2">{gps.lat.toFixed(5)},{gps.lng?.toFixed(5)}</span>}
                {gps.err && <p className="text-xs text-destructive">{gps.err}</p>}
              </div>

              <Button disabled={loading} onClick={completeVisit}>{loading ? "Completing..." : "Complete Visit → COMPLETED"}</Button>
            </div>
          )}

          {selected?.status === "COMPLETED" && (
            <div className="border rounded-md p-3 text-sm space-y-1">
              <p className="font-medium">Visit COMPLETED — immutable evidence preserved</p>
              <p>Started: {selected.startedAt ? new Date(selected.startedAt).toLocaleString() : "-"} • Completed: {selected.completedAt ? new Date(selected.completedAt).toLocaleString() : "-"}</p>
              <p>Start GPS: {selected.gpsLatitude ? "✓" : "—"} • Completion GPS: ✓ • Signature: {selected.customerSignature ? "✓" : sigReason || "—"}</p>
              <p className="text-xs text-muted-foreground">Completed visits cannot be modified via normal APIs.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
