"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { paymentSchema } from "@/lib/validators";
const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"] as const;

type PaymentItem = {
  _id: string;
  paymentId: string;
  invoice: { _id: string; invoiceId: string; totalAmount?: number; paidAmount?: number; paymentStatus?: string } | string;
  customer: { _id: string; companyName: string; customerId?: string } | string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  remarks?: string;
  receivedBy?: { name: string; email: string } | string;
  createdAt: string;
};

type InvOption = { _id: string; invoiceId: string; customer: { companyName: string }; totalAmount: number; paidAmount: number; outstanding: number; paymentStatus: string };

const canCreateByRole = (role: string) => ["super_admin", "manager", "accounts"].includes(role);

export default function PaymentsPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [invoices, setInvoices] = useState<InvOption[]>([]);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [myRole, setMyRole] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvOption | null>(null);

  // KPIs
  const [kpis, setKpis] = useState<{ totalPayments: number; totalAmount: number; thisMonthCount: number; thisMonthAmount: number; outstanding: number } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: { invoice: "", amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "OTHER", referenceNumber: "", remarks: "" },
  });

  const watchedInvoice = form.watch("invoice" as never) as unknown as string;
  const watchedAmount = form.watch("amount" as never) as unknown as number;

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (customerFilter !== "all") params.set("customer", customerFilter);
    if (invoiceFilter !== "all") params.set("invoice", invoiceFilter);
    if (methodFilter !== "all") params.set("paymentMethod", methodFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    try {
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (res.status === 403) {
        setError("Forbidden: payment.view required");
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      if (!res.ok) throw new Error(JSON.stringify(await res.json()));
      const d = await res.json();
      setItems(d.items || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load payments";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedQ, customerFilter, invoiceFilter, methodFilter, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, customerFilter, invoiceFilter, methodFilter, fromDate, toDate]);

  // Load customers/invoices for filters + dialog
  useEffect(() => {
    fetch("/api/customers?limit=100").then(async (r) => {
      if (r.ok) setCustomers((await r.json()).items || []);
    });
    fetch("/api/invoices?limit=100").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setInvoices(d.items || []);
        setInvoicesLoaded(true);
      }
    });
    fetch("/api/auth/me").then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        setMyRole(j.user?.role || "");
      }
    });
  }, []);

  // KPIs: reuse finance summary for outstanding + compute from payments
  useEffect(() => {
    let cancelled = false;
    async function fetchKpis() {
      setKpiLoading(true);
      try {
        const [finRes, allPayRes, monthRes] = await Promise.all([
          fetch("/api/finance/summary").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/payments?limit=100").then((r) => (r.ok ? r.json() : null)),
          (() => {
            const s = new Date();
            s.setDate(1);
            const from = s.toISOString().slice(0, 10);
            const to = new Date().toISOString().slice(0, 10);
            return fetch(`/api/payments?limit=100&from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null));
          })(),
        ]);
        if (cancelled) return;
        const outstanding = finRes?.revenue?.outstanding ?? 0;
        const totalPayments = allPayRes?.total ?? 0;
        const totalAmount = finRes?.revenue?.totalPaid ?? 0;
        // compute month amount by summing monthRes items if available, fallback 0
        const monthItems = (monthRes?.items || []) as PaymentItem[];
        const thisMonthAmount = monthItems.reduce((s, p) => s + (p.amount || 0), 0);
        const thisMonthCount = monthRes?.total ?? monthItems.length;
        setKpis({ totalPayments, totalAmount, thisMonthCount, thisMonthAmount, outstanding });
      } catch {
        // silent
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    }
    fetchKpis();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update selectedInvoice when dialog invoice changes
  useEffect(() => {
    if (!watchedInvoice) {
      setSelectedInvoice(null);
      return;
    }
    const found = invoices.find((x) => x._id === watchedInvoice) || null;
    if (found) {
      setSelectedInvoice(found);
    } else {
      // fetch single invoice if not in list (e.g. paginated)
      fetch(`/api/invoices/${watchedInvoice}`).then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          const enriched: InvOption = {
            _id: d._id,
            invoiceId: d.invoiceId,
            customer: d.customer || { companyName: "-" },
            totalAmount: d.totalAmount,
            paidAmount: d.paidAmount,
            outstanding: d.outstanding ?? d.totalAmount - d.paidAmount,
            paymentStatus: d.paymentStatus,
          };
          setSelectedInvoice(enriched);
        }
      }).catch(() => {});
    }
  }, [watchedInvoice, invoices]);

  const outstandingForSelected = selectedInvoice ? selectedInvoice.totalAmount - selectedInvoice.paidAmount : 0;
  const amountExceeds = selectedInvoice && watchedAmount ? Number(watchedAmount) > outstandingForSelected : false;

  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
  const canCreate = canCreateByRole(myRole);

  const clearFilters = () => {
    setQ("");
    setDebouncedQ("");
    setCustomerFilter("all");
    setInvoiceFilter("all");
    setMethodFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Money received from customers — Invoice is what customer owes, Payment is what was paid, Expense is what ESP Soln spent"
        action={canCreate ? <Button onClick={() => setOpen(true)}>Record Payment</Button> : null}
      />

      {/* Finance KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Payments</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{kpiLoading ? "—" : kpis?.totalPayments ?? total}</p><p className="text-xs text-muted-foreground">count across all invoices</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Amount Received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{kpiLoading ? "—" : inr(kpis?.totalAmount ?? 0)}</p><p className="text-xs text-muted-foreground">sum of all payments (from Finance)</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Payments This Month</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{kpiLoading ? "—" : kpis?.thisMonthCount ?? 0}</p><p className="text-xs text-muted-foreground">{kpiLoading ? "" : inr(kpis?.thisMonthAmount ?? 0)}</p></CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding Receivables</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{kpiLoading ? "—" : inr(kpis?.outstanding ?? 0)}</p><p className="text-xs text-muted-foreground">total invoiced − total paid</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search + Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                placeholder="Search Payment ID, Invoice ID, Customer, Reference..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="md:max-w-sm"
              />
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Select value={customerFilter} onValueChange={(v) => setCustomerFilter(v as string)}>
                <SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={invoiceFilter} onValueChange={(v) => setInvoiceFilter(v as string)}>
                <SelectTrigger><SelectValue placeholder="Invoice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invoices</SelectItem>
                  {invoices.map((inv) => <SelectItem key={inv._id} value={inv._id}>{inv.invoiceId} — {inr(inv.outstanding)} due</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as string)}>
                <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" />
              <Button variant="outline" onClick={load}>Refresh</Button>
            </div>
          </div>

          {error ? (
            <Card className="border-destructive"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card>
          ) : loading ? (
            <div className="text-sm text-muted-foreground p-6">Loading payments...</div>
          ) : items.length === 0 ? (
            <EmptyState title="No payments" description={debouncedQ || customerFilter !== "all" || invoiceFilter !== "all" || methodFilter !== "all" || fromDate || toDate ? "No payments match filters" : "No payments recorded yet — record a payment against an outstanding invoice"} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Received By</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => {
                      const inv = p.invoice as { invoiceId?: string } | string;
                      const cust = p.customer as { companyName?: string } | string;
                      const recv = p.receivedBy as { name?: string } | string;
                      return (
                        <TableRow key={p._id}>
                          <TableCell className="font-mono text-xs">{p.paymentId}</TableCell>
                          <TableCell className="text-xs">{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs">{typeof inv === "object" && inv ? (inv as { invoiceId: string }).invoiceId : "-"}</TableCell>
                          <TableCell className="text-xs">{typeof cust === "object" && cust ? (cust as { companyName: string }).companyName : "-"}</TableCell>
                          <TableCell className="font-medium">{inr(p.amount)}</TableCell>
                          <TableCell><Badge variant="outline">{p.paymentMethod}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{p.referenceNumber || "-"}</TableCell>
                          <TableCell className="text-xs">{typeof recv === "object" && recv ? (recv as { name: string }).name : "-"}</TableCell>
                          <TableCell className="text-xs">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell><Link href={`/dashboard/payments/${p._id}`}><Button size="xs" variant="outline">View</Button></Link></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-3 md:hidden">
                {items.map((p) => {
                  const inv = p.invoice as { invoiceId?: string } | string;
                  const cust = p.customer as { companyName?: string } | string;
                  return (
                    <Card key={p._id}>
                      <CardContent className="pt-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Payment ID</span><span className="font-mono font-medium">{p.paymentId}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(p.paymentDate).toLocaleDateString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-mono">{typeof inv === "object" && inv ? (inv as { invoiceId: string }).invoiceId : "-"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{typeof cust === "object" && cust ? (cust as { companyName: string }).companyName : "-"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">{inr(p.amount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Method</span><Badge variant="outline">{p.paymentMethod}</Badge></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{p.referenceNumber || "-"}</span></div>
                        <Link href={`/dashboard/payments/${p._id}`}><Button size="sm" variant="outline" className="w-full mt-2">View Details</Button></Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-2 pt-2">
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages} • Total {total} payments</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {!canCreate && <p className="text-sm text-destructive">You do not have permission to record payments (payment.create required — Engineer cannot).</p>}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (v: unknown) => {
                const vals = v as { invoice: string; amount: number; paymentDate?: string; paymentMethod: string; referenceNumber?: string; remarks?: string };
                if (selectedInvoice && Number(vals.amount) > outstandingForSelected) {
                  alert(`Amount exceeds outstanding ${inr(outstandingForSelected)}`);
                  return;
                }
                setSubmitting(true);
                const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vals) });
                setSubmitting(false);
                if (res.ok) {
                  setOpen(false);
                  form.reset({ invoice: "", amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "OTHER", referenceNumber: "", remarks: "" } as unknown as never);
                  setSelectedInvoice(null);
                  load();
                  // refresh KPIs after payment
                  fetch("/api/finance/summary").then(async (r) => {
                    if (r.ok) {
                      const d = await r.json();
                      setKpis((prev) => prev ? { ...prev, outstanding: d.revenue.outstanding, totalAmount: d.revenue.totalPaid } : prev);
                    }
                  });
                } else {
                  const err = await res.json().catch(() => ({ error: "Failed" }));
                  alert("Failed: " + (err.error || JSON.stringify(err)));
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="invoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice *</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder={invoicesLoaded ? "Select outstanding invoice" : "Loading..."} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {invoices
                          .filter((inv) => inv.outstanding > 0 && !["PAID", "CANCELLED"].includes(inv.paymentStatus))
                          .map((inv) => (
                            <SelectItem key={inv._id} value={inv._id}>{inv.invoiceId} • {inv.customer.companyName} • {inr(inv.outstanding)} due ({inv.paymentStatus})</SelectItem>
                          ))}
                        {invoices.filter((inv) => inv.outstanding > 0).length === 0 && invoicesLoaded && <SelectItem value="__none" disabled>No outstanding invoices</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedInvoice && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Invoice ID</span><span className="font-mono font-medium">{selectedInvoice.invoiceId}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{selectedInvoice.customer.companyName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span>{inr(selectedInvoice.totalAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span>{inr(selectedInvoice.paidAmount)}</span></div>
                    <div className="flex justify-between font-semibold"><span>Outstanding</span><span className={outstandingForSelected === 0 ? "text-green-600" : ""}>{inr(outstandingForSelected)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={selectedInvoice.paymentStatus === "PAID" ? "default" : selectedInvoice.paymentStatus === "PARTIAL" ? "secondary" : "outline"}>{selectedInvoice.paymentStatus}</Badge></div>
                    {outstandingForSelected === 0 && <p className="text-xs text-destructive pt-1">This invoice is fully paid — no payment needed.</p>}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount *</FormLabel>
                    <FormControl><Input type="number" step="0.01" value={(field.value as string | number) ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))} placeholder={selectedInvoice ? `max ${outstandingForSelected}` : ""} /></FormControl>
                    {amountExceeds && <p className="text-xs text-destructive">Exceeds outstanding {inr(outstandingForSelected)}</p>}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="paymentDate" render={({ field }) => (
                  <FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={field.value ?? "OTHER"} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="referenceNumber" render={({ field }) => (
                  <FormItem><FormLabel>Reference Number</FormLabel><FormControl><Input {...field} placeholder="UTR / Cheque No." /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} placeholder="Optional notes" rows={2} /></FormControl><FormMessage /></FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting || !canCreate || (selectedInvoice ? amountExceeds || outstandingForSelected === 0 : false)}>{submitting ? "Recording..." : "Record Payment"}</Button>
              </DialogFooter>
              {!canCreate && <p className="text-xs text-muted-foreground">Engineer role cannot record payments.</p>}
              <p className="text-xs text-muted-foreground">Customer is derived from invoice on server. Overpayment is blocked server-side as authoritative check.</p>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
