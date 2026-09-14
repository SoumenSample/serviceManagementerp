"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/common/page-header";
import { useAppAlert } from "@/components/common/alert-provider";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { equipmentSchema } from "@/lib/validators";

type Equipment = { _id: string; equipmentId: string; assetId?: string; serialNumber?: string; make?: string; model?: string; equipmentStatus: string; customer: { companyName: string }; site: { siteName: string } };
type Customer = { _id: string; companyName: string };
type Site = { _id: string; siteName: string; customer: string };

export default function EquipmentPage() {
  const { showAlert, showConfirm } = useAppAlert();
  const [items, setItems] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({ resolver: zodResolver(equipmentSchema), defaultValues: { equipmentStatus: "ACTIVE", customer: "", site: "" } as unknown as z.infer<typeof equipmentSchema> });

  async function load() {
    const res = await fetch(`/api/equipment?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
    if (res.ok) { const d = await res.json(); setItems(d.items); setTotalPages(d.totalPages); }
  }
  async function loadMasters() {
    const [cRes, sRes] = await Promise.all([fetch("/api/customers?limit=100"), fetch("/api/sites?limit=100")]);
    if (cRes.ok) { const d = await cRes.json(); setCustomers(d.items); }
    if (sRes.ok) { const d = await sRes.json(); setSites(d.items); }
  }
  useEffect(() => { load(); }, [q, page]);
  useEffect(() => { loadMasters(); }, []);

  const watchCustomer = form.watch("customer") as string;
  useEffect(() => {
    if (watchCustomer) setFilteredSites(sites.filter((s) => String((s as any).customer) === watchCustomer || (s.customer as unknown as { _id: string })?._id === watchCustomer));
    else setFilteredSites(sites);
  }, [watchCustomer, sites]);

  function onAdd() { form.reset({ equipmentStatus: "ACTIVE", customer: "", site: "" } as never); setOpen(true); }

  async function onSubmit(values: any) {
    setLoading(true);
    const res = await fetch("/api/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) { setOpen(false); load(); } else await showAlert("Failed: " + JSON.stringify(await res.json()), "Error");
  }
  async function onDelete(id: string) { if (!(await showConfirm("Delete equipment?", { title: "Confirm Delete" }))) return; await fetch(`/api/equipment/${id}`, { method: "DELETE" }); load(); }

  return (
    <div className="space-y-6">
      <PageHeader title="Equipment" description="View and Manage Equipment" action={<Button onClick={onAdd}>Add Equipment</Button>} />
      <Card><CardContent className="pt-6 space-y-4">
        <Input placeholder="Search Equipment ID, Asset ID, Serial, Make..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-sm" />
        {items.length === 0 ? <EmptyState title="No equipment" description="Add your first UPS/Inverter" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Equipment ID</TableHead><TableHead>Customer</TableHead><TableHead>Site</TableHead><TableHead>Make/Model</TableHead><TableHead>Serial</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((e) => (
              <TableRow key={e._id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/dashboard/equipment/${e._id}`}>
                <TableCell className="font-mono text-xs font-medium">{e.equipmentId}</TableCell>
                <TableCell>{e.customer?.companyName || "-"}</TableCell>
                <TableCell>{e.site?.siteName || "-"}</TableCell>
                <TableCell>{[e.make, e.model].filter(Boolean).join(" ") || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{e.serialNumber || "-"}</TableCell>
                <TableCell><Badge variant={e.equipmentStatus === "ACTIVE" ? "default" : e.equipmentStatus === "UNDER_REPAIR" ? "destructive" : "secondary"}>{e.equipmentStatus}</Badge></TableCell>
                <TableCell onClick={(ev) => ev.stopPropagation()}><Button size="xs" variant="destructive" onClick={() => onDelete(e._id)}>Delete</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Equipment</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="customer" render={({ field }) => (<FormItem><FormLabel>Customer *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="site" render={({ field }) => (<FormItem><FormLabel>Site *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{filteredSites.map((s) => <SelectItem key={s._id} value={s._id}>{s.siteName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="make" render={({ field }) => (<FormItem><FormLabel>Make</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="kvaCapacity" render={({ field }) => (<FormItem><FormLabel>KVA</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Serial Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="assetId" render={({ field }) => (<FormItem><FormLabel>Asset ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="equipmentType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><FormControl><Input placeholder="UPS/Inverter" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="equipmentStatus" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ACTIVE">ACTIVE</SelectItem><SelectItem value="UNDER_REPAIR">UNDER_REPAIR</SelectItem><SelectItem value="DECOMMISSIONED">DECOMMISSIONED</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="batteryMake" render={({ field }) => (<FormItem><FormLabel>Battery Make</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="batteryQuantity" render={({ field }) => (<FormItem><FormLabel>Battery Qty</FormLabel><FormControl><Input type="number" {...field as any} value={(field.value as any) ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Saving..." : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
