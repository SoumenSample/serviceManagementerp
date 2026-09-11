"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/common/page-header";
import { amcUpdateSchema } from "@/lib/validators";
import Link from "next/link";

export default function AmcEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);

  const form = useForm<any>({
    resolver: zodResolver(amcUpdateSchema),
    defaultValues: {},
  });

  useEffect(() => {
    fetch(`/api/amc/${id}`).then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        form.reset({
          customer: String(d.customer._id || d.customer),
          site: String(d.site._id || d.site),
          equipmentIds: d.equipmentIds.map((e: { _id: string }) => String(e._id)),
          amcType: d.amcType,
          startDate: d.startDate ? new Date(d.startDate).toISOString().slice(0, 10) : "",
          endDate: d.endDate ? new Date(d.endDate).toISOString().slice(0, 10) : "",
          contractAmount: d.contractAmount,
          paymentStatus: d.paymentStatus,
          assignedEngineer: d.assignedEngineer ? String(d.assignedEngineer._id || d.assignedEngineer) : "",
          terms: d.terms || "",
          status: d.status,
        });
      }
    });
    fetch("/api/engineers").then(async (r) => { if (r.ok) { const d = await r.json(); setEngineers(d.items); } });
  }, [id]);

  async function onSubmit(values: unknown) {
    setLoading(true);
    const res = await fetch(`/api/amc/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) router.push(`/dashboard/amc/${id}`);
    else alert("Failed: " + JSON.stringify(await res.json()));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Edit AMC" description="AMC ID is immutable • relationships re-validated on server" />
      <Card><CardHeader><CardTitle className="text-sm">Edit Contract</CardTitle></CardHeader><CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="amcType" render={({ field }) => (<FormItem><FormLabel>AMC Type</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem><SelectItem value="NON_COMPREHENSIVE">Non-Comprehensive</SelectItem><SelectItem value="PREVENTIVE_MAINTENANCE">Preventive</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="paymentStatus" render={({ field }) => (<FormItem><FormLabel>Payment Status</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="NOT_BILLED">NOT_BILLED</SelectItem><SelectItem value="INVOICED">INVOICED</SelectItem><SelectItem value="PARTIAL">PARTIAL</SelectItem><SelectItem value="PAID">PAID</SelectItem><SelectItem value="OVERDUE">OVERDUE</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="contractAmount" render={({ field }) => (<FormItem><FormLabel>Contract Amount (INR)</FormLabel><FormControl><Input type="number" min={0} value={(field.value as string) ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="assignedEngineer" render={({ field }) => (<FormItem><FormLabel>Assigned Engineer</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="terms" render={({ field }) => (<FormItem><FormLabel>Terms</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ACTIVE">ACTIVE</SelectItem><SelectItem value="CANCELLED">CANCELLED</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <div className="flex gap-2 justify-end">
              <Link href={`/dashboard/amc/${id}`}><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        </Form>
      </CardContent></Card>
    </div>
  );
}
