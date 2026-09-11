"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { AmcStatusBadge, PaymentStatusBadge, AmcTypeBadge, DaysRemainingBadge } from "@/components/amc/amc-badges";

type Amc = {
  _id: string;
  amcId: string;
  customer: { companyName: string };
  site: { siteName: string };
  equipmentIds: { equipmentId: string }[];
  amcType: string;
  startDate: string;
  endDate: string;
  contractAmount: number;
  paymentStatus: string;
  assignedEngineer?: { name: string };
  status: string;
  computedStatus: string;
  daysRemaining: number;
};

export default function AmcListPage() {
  const [items, setItems] = useState<Amc[]>([]);
  const [q, setQ] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");
  const [amcType, setAmcType] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ active: number; expiring15: number; expiring30: number; expired: number; total: number } | null>(null);
  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (q) params.set("q", q);
    if (customerFilter !== "all") params.set("customer", customerFilter);
    if (amcType !== "all") params.set("amcType", amcType);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (expiryFilter !== "all") params.set("expiry", expiryFilter);
    const res = await fetch(`/api/amc?${params.toString()}`);
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setTotalPages(d.totalPages);
    }
  }
  async function loadStats() {
    const res = await fetch("/api/amc/stats");
    if (res.ok) setStats(await res.json());
  }
  useEffect(() => { load(); }, [q, expiryFilter, amcType, paymentStatus, customerFilter, page]);
  useEffect(() => { loadStats(); fetch("/api/customers?limit=100").then(async (r) => { if (r.ok) { const d = await r.json(); setCustomers(d.items); } }); }, []);

  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader title="AMC Contracts" description="Comprehensive / Non-Comprehensive / Preventive —expiry calculated dynamically" action={<Link href="/dashboard/amc/new"><Button>New AMC</Button></Link>} />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={`cursor-pointer ${expiryFilter === "active" ? "ring-2 ring-primary" : ""}`} onClick={() => { setExpiryFilter("active"); setPage(1); }}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active AMC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.active}</p><p className="text-xs text-muted-foreground">Currently valid</p></CardContent>
          </Card>
          <Card className={`cursor-pointer ${expiryFilter === "expiring30" ? "ring-2 ring-primary" : ""}`} onClick={() => { setExpiryFilter("expiring30"); setPage(1); }}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring in 30 Days</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.expiring30}</p><p className="text-xs text-muted-foreground">16–30 days • outline</p></CardContent>
          </Card>
          <Card className={`cursor-pointer border-destructive/50 ${expiryFilter === "expiring15" ? "ring-2 ring-destructive" : ""}`} onClick={() => { setExpiryFilter("expiring15"); setPage(1); }}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring in 15 Days</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.expiring15}</p><p className="text-xs text-muted-foreground">0–15 days • destructive</p></CardContent>
          </Card>
          <Card className={`cursor-pointer ${expiryFilter === "expired" ? "ring-2 ring-destructive" : ""}`} onClick={() => { setExpiryFilter("expired"); setPage(1); }}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expired</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.expired}</p><p className="text-xs text-muted-foreground">End date passed</p></CardContent>
          </Card>
        </div>
      )}
      {expiryFilter !== "all" && <Button variant="outline" size="sm" onClick={() => { setExpiryFilter("all"); setPage(1); }}>Clear filter • Showing {expiryFilter}</Button>}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search AMC ID, Customer, Site, Equipment..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
            <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v as string); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Customer" /></SelectTrigger><SelectContent><SelectItem value="all">All Customers</SelectItem>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select>
            <Select value={amcType} onValueChange={(v) => { setAmcType(v as string); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="AMC Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem><SelectItem value="NON_COMPREHENSIVE">Non-Comprehensive</SelectItem><SelectItem value="PREVENTIVE_MAINTENANCE">Preventive</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select>
            <Select value={paymentStatus} onValueChange={(v) => { setPaymentStatus(v as string); setPage(1); }}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment" /></SelectTrigger><SelectContent><SelectItem value="all">All Payments</SelectItem><SelectItem value="NOT_BILLED">NOT_BILLED</SelectItem><SelectItem value="INVOICED">INVOICED</SelectItem><SelectItem value="PARTIAL">PARTIAL</SelectItem><SelectItem value="PAID">PAID</SelectItem><SelectItem value="OVERDUE">OVERDUE</SelectItem></SelectContent></Select>
          </div>

          {items.length === 0 ? <EmptyState title="No AMC contracts" description="Create your first AMC — AMC-YYYY-000001 will auto-generate" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>AMC ID</TableHead><TableHead>Customer</TableHead><TableHead>Site</TableHead><TableHead>Equipment</TableHead><TableHead>Type</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Days</TableHead><TableHead>Amount</TableHead><TableHead>Payment</TableHead><TableHead>Engineer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{items.map((a) => (
                  <TableRow key={a._id} className="cursor-pointer" onClick={() => window.location.href = `/dashboard/amc/${a._id}`}>
                    <TableCell className="font-mono text-xs font-medium">{a.amcId}</TableCell>
                    <TableCell>{a.customer?.companyName || "-"}</TableCell>
                    <TableCell>{a.site?.siteName || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{a.equipmentIds?.length || 0} Equipment</Badge></TableCell>
                    <TableCell><AmcTypeBadge type={a.amcType} /></TableCell>
                    <TableCell className="text-xs">{new Date(a.startDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{new Date(a.endDate).toLocaleDateString()}</TableCell>
                    <TableCell><DaysRemainingBadge endDate={a.endDate} startDate={a.startDate} storedStatus={a.status} /></TableCell>
                    <TableCell className="text-xs">{inr(a.contractAmount)}</TableCell>
                    <TableCell><PaymentStatusBadge status={a.paymentStatus} /></TableCell>
                    <TableCell className="text-xs">{a.assignedEngineer?.name || "-"}</TableCell>
                    <TableCell><AmcStatusBadge startDate={a.startDate} endDate={a.endDate} storedStatus={a.status} /></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
