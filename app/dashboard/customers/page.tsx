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
import { customerSchema } from "@/lib/validators";

type Customer = { _id: string; customerId: string; companyName: string; contactPerson?: string; mobile?: string; email?: string; status: string; createdAt: string };

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<any>({ resolver: zodResolver(customerSchema), defaultValues: { companyName: "", status: "ACTIVE" } });

  async function load() {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotalPages(data.totalPages);
    }
  }
  useEffect(() => { load(); }, [q, page]);

  function onAdd() { setEditing(null); form.reset({ companyName: "", contactPerson: "", mobile: "", email: "", billingAddress: "", gstNumber: "", remarks: "", status: "ACTIVE" }); setOpen(true); }
  function onEdit(c: Customer) { setEditing(c); form.reset({ companyName: c.companyName, contactPerson: c.contactPerson || "", mobile: c.mobile || "", email: c.email || "", status: c.status as never }); setOpen(true); }

  async function onSubmit(values: any) {
    setLoading(true);
    const url = editing ? `/api/customers/${editing._id}` : "/api/customers";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) { setOpen(false); load(); } else alert("Failed: " + (await res.json()).error);
  }
  async function onDelete(id: string) { if (!confirm("Delete customer?")) return; await fetch(`/api/customers/${id}`, { method: "DELETE" }); load(); }

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Customer master — one customer can have multiple sites" action={<Button onClick={onAdd}>Add Customer</Button>} />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Search by company, ID, email..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-sm" />
          </div>
          {items.length === 0 ? <EmptyState title="No customers" description="Add your first customer" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Customer ID</TableHead><TableHead>Company/Customer Name</TableHead><TableHead>Contact</TableHead><TableHead>Mobile</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>{items.map((c) => (
                <TableRow key={c._id}>
                  <TableCell className="font-mono text-xs">{c.customerId}</TableCell>
                  <TableCell className="font-medium">{c.companyName}</TableCell>
                  <TableCell>{c.contactPerson || "-"}</TableCell>
                  <TableCell>{c.mobile || "-"}</TableCell>
                  <TableCell><Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="flex gap-1"><Button size="xs" variant="outline" onClick={() => onEdit(c)}>Edit</Button><Button size="xs" variant="destructive" onClick={() => onDelete(c._id)}>Delete</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company/Customer Name *</FormLabel><FormControl><Input {...field} placeholder="Enter company or customer name" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="mobile" render={({ field }) => (<FormItem><FormLabel>Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="billingAddress" render={({ field }) => (<FormItem><FormLabel>Billing Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="gstNumber" render={({ field }) => (<FormItem><FormLabel>GST Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ACTIVE">ACTIVE</SelectItem><SelectItem value="INACTIVE">INACTIVE</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Saving..." : editing ? "Update" : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
