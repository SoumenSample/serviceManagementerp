"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppAlert } from "@/components/common/alert-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/common/page-header";
import { serviceCallSchema } from "@/lib/validators";
import Link from "next/link";

function NewServiceCallPageInner() {
  const router = useRouter();
  const { showAlert } = useAppAlert();
  const searchParams = useSearchParams();
  const equipmentId = searchParams.get("equipmentId");
  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [sites, setSites] = useState<{ _id: string; siteName: string; customer: string }[]>([]);
  const [equipment, setEquipment] = useState<{ _id: string; equipmentId: string; site: string }[]>([]);
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);
  const [filteredSites, setFilteredSites] = useState<typeof sites>([]);
  const [filteredEq, setFilteredEq] = useState<typeof equipment>([]);
  const [loading, setLoading] = useState(false);
  const [qrEquipment, setQrEquipment] = useState<{ _id: string; customer: string; site: string; equipmentId: string } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [prefillStage, setPrefillStage] = useState(0);

  const form = useForm<any>({
    resolver: zodResolver(serviceCallSchema),
    defaultValues: { customer: "", site: "", equipment: "", complaintType: "BREAKDOWN", priority: "MEDIUM", complaintDate: new Date().toISOString().slice(0, 10), problemDescription: "", assignedEngineer: "", targetVisitDate: "" },
  });

  useEffect(() => {
    fetch("/api/customers?limit=100").then(async (r) => { if (r.ok) setCustomers((await r.json()).items); });
    fetch("/api/sites?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setSites(d.items.map((s: { _id: string; siteName: string; customer: { _id: string } | string }) => ({ _id: s._id, siteName: s.siteName, customer: typeof s.customer === "object" && s.customer !== null ? (s.customer as { _id: string })._id : String(s.customer) }))); } });
    fetch("/api/equipment?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setEquipment(d.items.map((e: { _id: string; equipmentId: string; site: { _id: string } | string }) => ({ _id: e._id, equipmentId: e.equipmentId, site: typeof e.site === "object" ? (e.site as { _id: string })._id : e.site }))); } });
    fetch("/api/engineers").then(async (r) => { if (r.ok) setEngineers((await r.json()).items); });
  }, []);

  // Fetch QR equipment when equipmentId is present
  useEffect(() => {
    if (!equipmentId) return;
    setQrLoading(true);
    setQrError(null);
    fetch(`/api/equipment/${equipmentId}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Equipment not found");
        }
        const d = await r.json();
        const custId = typeof d.customer === "object" && d.customer !== null ? String(d.customer._id || d.customer) : String(d.customer);
        const siteId = typeof d.site === "object" && d.site !== null ? String(d.site._id || d.site) : String(d.site);
        setQrEquipment({ _id: String(d._id), customer: custId, site: siteId, equipmentId: d.equipmentId });
      })
      .catch((e) => setQrError(e.message || "Invalid equipment"))
      .finally(() => setQrLoading(false));
  }, [equipmentId]);

  const watchCustomer = form.watch("customer");
  const watchSite = form.watch("site");

  useEffect(() => {
    if (watchCustomer) {
      setFilteredSites(sites.filter((s) => String(s.customer) === String(watchCustomer)));
      const currentSite = form.getValues("site");
      if (currentSite && !sites.some((s) => s._id === currentSite && String(s.customer) === String(watchCustomer))) {
        // Don't clear if we're in prefill stage 1 waiting for site to be set
        if (prefillStage !== 1) {
          form.setValue("site", "");
          setFilteredEq([]);
        }
      }
    } else {
      setFilteredSites([]);
      if (prefillStage === 0) form.setValue("site", "");
    }
  }, [watchCustomer, sites]);

  useEffect(() => {
    if (watchSite) {
      setFilteredEq(equipment.filter((e) => String(e.site) === watchSite));
      const curEq = form.getValues("equipment");
      if (curEq && !equipment.some((e) => e._id === curEq && String(e.site) === String(watchSite))) {
        if (prefillStage !== 2) form.setValue("equipment", "");
      }
    } else {
      setFilteredEq([]);
      if (prefillStage === 0) form.setValue("equipment", "");
    }
  }, [watchSite, equipment]);

  // Stage 0 -> 1: set customer when all data ready
  useEffect(() => {
    if (!qrEquipment || prefillStage !== 0) return;
    if (customers.length === 0 || sites.length === 0 || equipment.length === 0) return;
    if (qrLoading) return;
    const custExists = customers.some((c) => c._id === qrEquipment.customer);
    const siteExists = sites.some((s) => s._id === qrEquipment.site);
    if (!custExists || !siteExists) {
      setQrError("Equipment customer/site not found in available options");
      return;
    }
    form.setValue("customer", qrEquipment.customer);
    setPrefillStage(1);
  }, [qrEquipment, customers, sites, equipment, qrLoading, prefillStage]);

  // Stage 1 -> 2: set site when filteredSites contains it
  useEffect(() => {
    if (prefillStage !== 1 || !qrEquipment) return;
    if (filteredSites.some((s) => s._id === qrEquipment.site)) {
      form.setValue("site", qrEquipment.site);
      setPrefillStage(2);
    }
  }, [prefillStage, filteredSites, qrEquipment]);

  // Stage 2 -> 3: set equipment when filteredEq contains it
  useEffect(() => {
    if (prefillStage !== 2 || !qrEquipment) return;
    if (filteredEq.some((e) => e._id === qrEquipment._id)) {
      form.setValue("equipment", qrEquipment._id);
      setPrefillStage(3);
    } else if (equipment.some((e) => e._id === qrEquipment._id)) {
      // Fallback: equipment exists but filteredEq not yet updated; wait one tick then set if site matches
      const t = setTimeout(() => {
        if (String(form.getValues("site")) === String(qrEquipment.site)) {
          form.setValue("equipment", qrEquipment._id);
          setPrefillStage(3);
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [prefillStage, filteredEq, qrEquipment, equipment]);

  async function onSubmit(values: unknown) {
    setLoading(true);
    const res = await fetch("/api/service-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) {
      const doc = await res.json();
      router.push(`/dashboard/service-calls/${doc._id}`);
    } else await showAlert("Failed: " + JSON.stringify(await res.json()), "Error");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="New Service Call" description="Customer → Site → Equipment • Call ID SC-YYYY-000001 auto-generated" />
      {equipmentId && (
        <div className="rounded-md border p-3 text-sm">
          {qrLoading && <p className="text-muted-foreground">Loading equipment {equipmentId}...</p>}
          {qrError && <p className="text-destructive">QR prefill error: {qrError}</p>}
          {qrEquipment && !qrError && !qrLoading && (
            <p className={prefillStage === 3 ? "text-green-600" : "text-muted-foreground"}>
              {prefillStage === 3 ? `Prefilled from QR: ${qrEquipment.equipmentId} ✓` : `Prefilling equipment ${qrEquipment.equipmentId}...`}
            </p>
          )}
          {!qrLoading && !qrEquipment && !qrError && <p className="text-muted-foreground">Equipment ID: {equipmentId}</p>}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="text-sm">Complaint Details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="customer" render={({ field }) => {
                const label = customers.find((c) => c._id === field.value)?.companyName;
                return (<FormItem><FormLabel>Customer *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label || <span className="text-muted-foreground">Select customer</span>}</span></SelectTrigger></FormControl><SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />
              <FormField control={form.control} name="site" render={({ field }) => {
                const label = filteredSites.find((s) => s._id === field.value)?.siteName;
                return (<FormItem><FormLabel>Site *</FormLabel><Select value={field.value ?? ""} onValueChange={(v) => { field.onChange(v); form.setValue("equipment", ""); }} disabled={!watchCustomer}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label || <span className="text-muted-foreground">{watchCustomer ? "Select site" : "Customer first"}</span>}</span></SelectTrigger></FormControl><SelectContent>{filteredSites.length === 0 ? <div className="px-2 py-1.5 text-xs text-muted-foreground">{watchCustomer ? "No sites for this customer" : "Select customer first"}</div> : filteredSites.map((s) => <SelectItem key={s._id} value={s._id}>{s.siteName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />
              <FormField control={form.control} name="equipment" render={({ field }) => {
                const label = field.value ? filteredEq.find((e) => e._id === field.value)?.equipmentId : null;
                return (<FormItem><FormLabel>Equipment</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)} disabled={!watchSite}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label || (field.value === "" || field.value === "none" ? <span className="text-muted-foreground">{watchSite ? "Select equipment" : "Site first"}</span> : field.value)}</span></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{filteredEq.map((e) => <SelectItem key={e._id} value={e._id}>{e.equipmentId}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="complaintDate" render={({ field }) => (<FormItem><FormLabel>Complaint Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="complaintTime" render={({ field }) => (<FormItem><FormLabel>Complaint Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="complaintType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{field.value || "Select"}</span></SelectTrigger></FormControl><SelectContent><SelectItem value="BREAKDOWN">BREAKDOWN</SelectItem><SelectItem value="PREVENTIVE">PREVENTIVE</SelectItem><SelectItem value="INSTALLATION">INSTALLATION</SelectItem><SelectItem value="OTHER">OTHER</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{field.value || "Select"}</span></SelectTrigger></FormControl><SelectContent><SelectItem value="CRITICAL">CRITICAL</SelectItem><SelectItem value="HIGH">HIGH</SelectItem><SelectItem value="MEDIUM">MEDIUM</SelectItem><SelectItem value="LOW">LOW</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              </div>

              <FormField control={form.control} name="problemDescription" render={({ field }) => (<FormItem><FormLabel>Problem Description *</FormLabel><FormControl><Textarea {...field} placeholder="Describe the issue..." /></FormControl><FormMessage /></FormItem>)} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="assignedEngineer" render={({ field }) => {
                const label = field.value ? engineers.find((e) => e._id === field.value)?.name : "None (NEW)";
                return (<FormItem><FormLabel>Assigned Engineer</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label}</span></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None (NEW)</SelectItem>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />
                <FormField control={form.control} name="targetVisitDate" render={({ field }) => (<FormItem><FormLabel>Target Visit Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div className="flex gap-2 justify-end">
                <Link href="/dashboard/service-calls"><Button type="button" variant="outline">Cancel</Button></Link>
                <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create SC"}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewServiceCallPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading...</p>}>
      <NewServiceCallPageInner />
    </Suspense>
  );
}
