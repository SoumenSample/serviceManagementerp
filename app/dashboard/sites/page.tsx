"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/common/page-header";
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
import { siteSchema } from "@/lib/validators";

type Site = { _id: string; siteId: string; siteName: string; city?: string; status: string; customer: { companyName: string; customerId: string } | string; assignedEngineer?: { name: string } };
type Customer = { _id: string; companyName: string };

export default function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({ resolver: zodResolver(siteSchema), defaultValues: { siteName: "", status: "ACTIVE", customer: "" } as unknown as any });

  async function load() {
    const res = await fetch(`/api/sites?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
    if (res.ok) { const d = await res.json(); setItems(d.items); setTotalPages(d.totalPages); }
  }
  async function loadCustomers() {
    const res = await fetch("/api/customers?limit=100");
    if (res.ok) { const d = await res.json(); setCustomers(d.items); }
  }
  async function loadEngineers() {
    const res = await fetch("/api/engineers");
    if (res.ok) { const d = await res.json(); setEngineers(d.items); }
  }
  useEffect(() => { load(); }, [q, page]);
  useEffect(() => { loadCustomers(); loadEngineers(); }, []);

  function onAdd() { setEditing(null); form.reset({ siteName: "", status: "ACTIVE", customer: "" } as never); setOpen(true); }
  function onEdit(s: Site) {
    setEditing(s);
    form.reset({
      customer: typeof s.customer === "object" ? (s.customer as unknown as { _id?: string })._id as string || "" : s.customer as string,
      siteName: s.siteName,
      city: (s as unknown as { city?: string }).city || "",
      status: s.status as never,
    } as never);
    setOpen(true);
  }
  async function onSubmit(values: any) {
    setLoading(true);
    const url = editing ? `/api/sites/${editing._id}` : "/api/sites";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) { setOpen(false); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
  }
  async function onDelete(id: string) { if (!confirm("Delete site?")) return; await fetch(`/api/sites/${id}`, { method: "DELETE" }); load(); }

  return (
    <div className="space-y-6">
      <PageHeader title="Sites" description="View and Manage Sites" action={<Button onClick={onAdd}>Add Site</Button>} />
      <Card><CardContent className="pt-6 space-y-4">
        <Input placeholder="Search site name, ID, city..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-sm" />
        {items.length === 0 ? <EmptyState title="No sites" description="Add your first site" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Site ID</TableHead><TableHead>Site Name</TableHead><TableHead>Customer</TableHead><TableHead>City</TableHead><TableHead>Engineer</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((s) => (
              <TableRow key={s._id}>
                <TableCell className="font-mono text-xs">{s.siteId}</TableCell>
                <TableCell className="font-medium">{s.siteName}</TableCell>
                <TableCell>{typeof s.customer === "object" ? (s.customer as { companyName: string }).companyName : s.customer}</TableCell>
                <TableCell>{(s as unknown as { city?: string }).city || "-"}</TableCell>
                <TableCell>{s.assignedEngineer?.name || "-"}</TableCell>
                <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell className="flex gap-1"><Button size="xs" variant="outline" onClick={() => onEdit(s)}>Edit</Button><Button size="xs" variant="destructive" onClick={() => onDelete(s._id)}>Delete</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Site" : "Add Site"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="customer" render={({ field }) => (<FormItem><FormLabel>Customer *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl><SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="siteName" render={({ field }) => (<FormItem><FormLabel>Site Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="pincode" render={({ field }) => (<FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="assignedEngineer" render={({ field }) => (<FormItem><FormLabel>Assigned Engineer</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="siteAddress" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="gpsLatitude" render={({ field }) => (<FormItem><FormLabel>GPS Latitude</FormLabel><FormControl><Input type="number" step="any" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gpsLongitude" render={({ field }) => (<FormItem><FormLabel>GPS Longitude</FormLabel><FormControl><Input type="number" step="any" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ACTIVE">ACTIVE</SelectItem><SelectItem value="INACTIVE">INACTIVE</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Saving..." : editing ? "Update" : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

