"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { amcSchema } from "@/lib/validators";
import Link from "next/link";

export default function AmcNewPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [sites, setSites] = useState<{ _id: string; siteName: string; customer: string }[]>([]);
  const [equipment, setEquipment] = useState<{ _id: string; equipmentId: string; site: string }[]>([]);
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);
  const [filteredSites, setFilteredSites] = useState<{ _id: string; siteName: string; customer: string }[]>([]);
  const [filteredEq, setFilteredEq] = useState<{ _id: string; equipmentId: string; site: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<any>({ resolver: zodResolver(amcSchema), defaultValues: { customer: "", site: "", amcType: "COMPREHENSIVE", paymentStatus: "NOT_BILLED", status: "ACTIVE", contractAmount: 0, equipmentIds: [], startDate: "", endDate: "", assignedEngineer: "", terms: "" } });

  useEffect(() => {
    fetch("/api/customers?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setCustomers(d.items); } });
    // keep full sites list for fallback/debugging, but filteredSites now comes from server
    fetch("/api/sites?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setSites(d.items.map((s: { _id: string; siteName: string; customer: { _id: string } | string }) => ({ _id: s._id, siteName: s.siteName, customer: typeof s.customer === "object" && s.customer !== null ? String((s.customer as { _id: string })._id) : String(s.customer) }))); } });
    fetch("/api/equipment?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setEquipment(d.items.map((e: { _id: string; equipmentId: string; site: { _id: string } | string }) => ({ _id: e._id, equipmentId: e.equipmentId, site: typeof e.site === "object" ? (e.site as { _id: string })._id : e.site }))); } });
    fetch("/api/engineers").then(async (r) => { if (r.ok) { const d = await r.json(); setEngineers(d.items); } });
  }, []);

  const watchCustomer = form.watch("customer");
  const watchSite = form.watch("site");

  // Server-side filtered sites – avoids client ObjectId vs string mismatch + stale closure
  useEffect(() => {
    if (!watchCustomer) {
      setFilteredSites([]);
      const cur = form.getValues("site");
      if (cur) form.setValue("site", "");
      return;
    }
    let cancelled = false;
    fetch(`/api/sites?customer=${encodeURIComponent(watchCustomer)}&limit=100`).then(async (r) => {
      if (cancelled) return;
      if (r.ok) {
        const d = await r.json();
        if (!cancelled) {
          let normalized = d.items.map((s: { _id: string; siteName: string }) => ({ _id: s._id, siteName: (s as unknown as { siteName: string }).siteName, customer: watchCustomer }));
          // If server returns empty but client cache has match (e.g. casting/mismatch), fallback to client filter
          if (normalized.length === 0 && sites.length > 0) {
            const clientFallback = sites.filter((s) => String(s.customer) === String(watchCustomer));
            if (clientFallback.length > 0) normalized = clientFallback;
          }
          setFilteredSites(normalized);
          const cur = form.getValues("site");
          if (cur && !normalized.some((s: { _id: string }) => s._id === cur)) {
            form.setValue("site", "");
            setFilteredEq([]);
          }
        }
      } else {
        const fallback = sites.filter((s) => String(s.customer) === String(watchCustomer));
        if (!cancelled) setFilteredSites(fallback);
      }
    });
    return () => { cancelled = true; };
  }, [watchCustomer, sites]);

  useEffect(() => {
    if (watchSite) setFilteredEq(equipment.filter((e) => String(e.site) === watchSite));
    else setFilteredEq([]);
    // Clear equipment selection when site changes
    if (watchSite) form.setValue("equipmentIds", []);
  }, [watchSite, equipment]);

  async function onSubmit(values: unknown) {
    setLoading(true);
    const res = await fetch("/api/amc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) {
      const doc = await res.json();
      router.push(`/dashboard/amc/${doc._id}`);
    } else {
      const err = await res.json();
      alert("Failed: " + JSON.stringify(err));
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="New AMC Contract" description="Customer → Site → Equipment cascading • Validations on server" />
      <Card>
        <CardHeader><CardTitle className="text-sm">Contract Details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="customer" render={({ field }) => {
                const label = customers.find((c) => c._id === field.value)?.companyName;
                return (<FormItem><FormLabel>Customer *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label || <span className="text-muted-foreground">Select customer</span>}</span></SelectTrigger></FormControl><SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />
              <FormField control={form.control} name="site" render={({ field }) => {
                const label = filteredSites.find((s) => s._id === field.value)?.siteName;
                return (<FormItem><FormLabel>Site *</FormLabel><Select value={field.value ?? ""} onValueChange={(v) => { field.onChange(v); form.setValue("equipmentIds", []); }} disabled={!watchCustomer}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label || <span className="text-muted-foreground">{watchCustomer ? "Select site" : "Select customer first"}</span>}</span></SelectTrigger></FormControl><SelectContent>{filteredSites.length === 0 ? <div className="px-2 py-1.5 text-xs text-muted-foreground">{watchCustomer ? "No sites for this customer" : "Select customer first"}</div> : filteredSites.map((s) => <SelectItem key={s._id} value={s._id}>{s.siteName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />

              <FormField control={form.control} name="equipmentIds" render={({ field }) => (
                <FormItem><FormLabel>Equipment * (multiple)</FormLabel>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-auto">
                    {filteredEq.length === 0 ? <p className="text-xs text-muted-foreground">{watchSite ? "No equipment for this site" : "Select site first"}</p> : filteredEq.map((e) => (
                      <label key={e._id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={field.value?.includes(e._id)} onCheckedChange={(checked) => {
                          const curr: string[] = field.value || [];
                          field.onChange(checked ? [...curr, e._id] : curr.filter((id) => id !== e._id));
                        }} />
                        <span className="font-mono text-xs">{e.equipmentId}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amcType" render={({ field }) => (<FormItem><FormLabel>AMC Type *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem><SelectItem value="NON_COMPREHENSIVE">Non-Comprehensive</SelectItem><SelectItem value="PREVENTIVE_MAINTENANCE">Preventive Maintenance</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="paymentStatus" render={({ field }) => (<FormItem><FormLabel>Payment Status</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="NOT_BILLED">NOT_BILLED</SelectItem><SelectItem value="INVOICED">INVOICED</SelectItem><SelectItem value="PARTIAL">PARTIAL</SelectItem><SelectItem value="PAID">PAID</SelectItem><SelectItem value="OVERDUE">OVERDUE</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date *</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>End Date *</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <FormField control={form.control} name="contractAmount" render={({ field }) => (<FormItem><FormLabel>Contract Amount (INR) *</FormLabel><FormControl><Input type="number" min={0} value={(field.value as string) ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>)} />

              <FormField control={form.control} name="assignedEngineer" render={({ field }) => {
                const label = field.value ? engineers.find((e) => e._id === field.value)?.name : "None";
                return (<FormItem><FormLabel>Assigned Engineer</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><span className="flex-1 text-left truncate">{label || "None"}</span></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
              }} />

              <FormField control={form.control} name="terms" render={({ field }) => (<FormItem><FormLabel>Terms</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} placeholder="Contract terms..." /></FormControl><FormMessage /></FormItem>)} />

              <div className="flex gap-2 justify-end">
                <Link href="/dashboard/amc"><Button type="button" variant="outline">Cancel</Button></Link>
                <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create AMC"}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
