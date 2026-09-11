"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { invoiceSchema } from "@/lib/validators";

type Inv = { _id: string; invoiceId: string; customer: { companyName: string }; totalAmount: number; paidAmount: number; outstanding: number; overdue: boolean; paymentStatus: string; invoiceDate: string; dueDate?: string };

export default function InvoicesPage() {
  const [items, setItems] = useState<Inv[]>([]);
  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<any>({ resolver: zodResolver(invoiceSchema), defaultValues: { customer: "", amount: 0, invoiceDate: new Date().toISOString().slice(0, 10) } });

  async function load() {
    const res = await fetch("/api/invoices?limit=20");
    if (res.ok) setItems((await res.json()).items);
  }
  useEffect(() => { load(); fetch("/api/customers?limit=100").then(async (r) => { if (r.ok) setCustomers((await r.json()).items); }); }, []);
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="INV-YYYY-000001 • outstanding = total - paid • overdue = dueDate < today && outstanding>0" action={<Button onClick={() => setOpen(true)}>New Invoice</Button>} />
      <Card><CardContent className="pt-6 space-y-4">
        {items.length === 0 ? <EmptyState title="No invoices" description="Create invoice for AMC/Service" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Invoice ID</TableHead><TableHead>Customer</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Outstanding</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((i) => <TableRow key={i._id}><TableCell className="font-mono text-xs">{i.invoiceId}</TableCell><TableCell>{i.customer.companyName}</TableCell><TableCell>{inr(i.totalAmount)}</TableCell><TableCell>{inr(i.paidAmount)}</TableCell><TableCell>{inr(i.outstanding)} {i.overdue && <Badge variant="destructive">OVERDUE</Badge>}</TableCell><TableCell><Badge variant={i.paymentStatus === "PAID" ? "default" : i.paymentStatus === "OVERDUE" ? "destructive" : "outline"}>{i.paymentStatus}</Badge></TableCell><TableCell className="text-xs">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "-"}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (v: unknown) => {
              setLoading(true); const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); setLoading(false);
              if (res.ok) { setOpen(false); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
            })} className="space-y-3">
              <FormField control={form.control} name="customer" render={({ field }) => (<FormItem><FormLabel>Customer *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount *</FormLabel><FormControl><Input type="number" value={(field.value as string) ?? ""} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="taxAmount" render={({ field }) => (<FormItem><FormLabel>Tax</FormLabel><FormControl><Input type="number" value={(field.value as string) ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="invoiceDate" render={({ field }) => (<FormItem><FormLabel>Invoice Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
