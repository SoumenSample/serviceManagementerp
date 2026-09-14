"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppAlert } from "@/components/common/alert-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
type ReportType = "open-calls" | "pending-calls" | "closed-calls" | "amc" | "equipment" | "engineer" | "parts" | "expenses" | "monthly" | "sla";

const REPORTS: { id: ReportType; label: string }[] = [
  { id: "open-calls", label: "Open Calls" },
  { id: "pending-calls", label: "Pending Calls" },
  { id: "closed-calls", label: "Closed Calls" },
  { id: "amc", label: "AMC Report" },
  { id: "equipment", label: "Equipment Report" },
  { id: "engineer", label: "Engineer Performance" },
  { id: "parts", label: "Parts Report" },
  { id: "expenses", label: "Expense Report" },
  { id: "monthly", label: "Monthly Service" },
  { id: "sla", label: "SLA Report" },
];

export default function ReportsPage() {
  const { showAlert } = useAppAlert();
  const [report, setReport] = useState<ReportType>("open-calls");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("");
  const [site, setSite] = useState("");
  const [engineer, setEngineer] = useState("");
  const [customers, setCustomers] = useState<{ _id: string; companyName: string }[]>([]);
  const [sites, setSites] = useState<{ _id: string; siteName: string }[]>([]);
  const [engineers, setEngineers] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/customers?limit=100").then(async (r) => { if (r.ok) setCustomers((await r.json()).items); });
    fetch("/api/sites?limit=100").then(async (r) => { if (r.ok) setSites((await r.json()).items); });
    fetch("/api/engineers").then(async (r) => { if (r.ok) setEngineers((await r.json()).items); });
  }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ report, page: String(page), limit: "10" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (customer) params.set("customer", customer);
    if (site) params.set("site", site);
    if (engineer) params.set("engineer", engineer);
    const res = await fetch(`/api/reports?${params.toString()}`);
    setLoading(false);
    if (res.ok) { const d = await res.json(); setItems(d.items); setSummary(d.summary); setTotalPages(d.totalPages); }
    else if (res.status === 403) { setItems([]); await showAlert("Forbidden reports.view", "Error"); }
  }
  useEffect(() => { load(); }, [report, page, from, to, customer, site, engineer]);
  useEffect(() => { setPage(1); }, [report, from, to, customer, site, engineer]);

  async function exportExcel() {
    const params = new URLSearchParams({ report, from, to, customer, site, engineer });
    const res = await fetch(`/api/reports/export?${params.toString()}&format=excel`);
    if (!res.ok) {
      if (res.status === 403) { await showAlert("Forbidden reports.export", "Error"); return; }
      const j = await res.json().catch(() => ({}));
      await showAlert("Export failed: " + (j.error || res.statusText), "Error"); return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${report}.xlsx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportPdf() {
    const params = new URLSearchParams({ report, from, to, customer, site, engineer });
    const res = await fetch(`/api/reports/export?${params.toString()}&format=pdf`);
    if (!res.ok) {
      if (res.status === 403) { await showAlert("Forbidden reports.export", "Error"); return; }
      const j = await res.json().catch(() => ({}));
      await showAlert("Export failed: " + (j.error || res.statusText), "Error"); return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${report}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

function ReportTable({ report, items }: { report: ReportType; items: Record<string, unknown>[] }) {
  const cols = getColumns(report);
  return (
    <Table>
      <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.key}>{c.header}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{items.map((row, i) => {
        const flat = flattenRow(report, row);
        return <TableRow key={i}>{cols.map((c) => <TableCell key={c.key} className="text-xs max-w-[170px] truncate">{formatCell(flat[c.key], c.key)}</TableCell>)}</TableRow>;
      })}</TableBody>
    </Table>
  );
}

function getColumns(report: ReportType): { header: string; key: string }[] {
  if (["open-calls", "pending-calls", "closed-calls", "sla", "monthly"].includes(report)) {
    return [
      { header: "Call ID", key: "callId" },
      { header: "Customer", key: "customer" },
      { header: "Site", key: "site" },
      { header: "Equipment", key: "equipment" },
      { header: "Priority", key: "priority" },
      { header: "Engineer", key: "engineer" },
      { header: "Status", key: "status" },
      { header: "Complaint Date", key: "complaintDate" },
    ];
  }
  if (report === "amc") return [
    { header: "AMC ID", key: "amcId" },
    { header: "Customer", key: "customer" },
    { header: "Site", key: "site" },
    { header: "Type", key: "amcType" },
    { header: "Start", key: "startDate" },
    { header: "End", key: "endDate" },
    { header: "Status", key: "status" },
    { header: "Amount", key: "amount" },
  ];
  if (report === "equipment") return [
    { header: "Equipment ID", key: "equipmentId" },
    { header: "Asset ID", key: "assetId" },
    { header: "Customer", key: "customer" },
    { header: "Site", key: "site" },
    { header: "Make/Model", key: "makeModel" },
    { header: "Serial", key: "serialNumber" },
    { header: "Status", key: "status" },
    { header: "Service Count", key: "serviceCount" },
  ];
  if (report === "engineer") return [
    { header: "Name", key: "name" },
    { header: "Email", key: "email" },
    { header: "Assigned", key: "assigned" },
    { header: "Visits", key: "visits" },
    { header: "Completed", key: "completedVisits" },
    { header: "Expenses", key: "approvedExpenses" },
  ];
  if (report === "parts") return [
    { header: "Part ID", key: "partId" },
    { header: "SKU", key: "partNumber" },
    { header: "Name", key: "name" },
    { header: "Category", key: "category" },
    { header: "Available", key: "available" },
    { header: "Min Stock", key: "minimumStockLevel" },
  ];
  if (report === "expenses") return [
    { header: "Expense ID", key: "expenseId" },
    { header: "Service Call", key: "callId" },
    { header: "Visit", key: "visitId" },
    { header: "Incurred By", key: "incurredBy" },
    { header: "Source", key: "costSource" },
    { header: "Category", key: "category" },
    { header: "Amount", key: "amount" },
    { header: "Status", key: "status" },
  ];
  return [{ header: "ID", key: "id" }];
}

function flattenRow(report: ReportType, row: Record<string, unknown>): Record<string, unknown> {
  const get = (obj: unknown, path: string) => {
    const o = obj as Record<string, unknown>;
    if (o[path] !== undefined) return o[path];
    return "";
  };
  const customer = (row.customer as { companyName?: string } | undefined)?.companyName || (typeof row.customer === "string" ? row.customer : "") || "";
  const site = (row.site as { siteName?: string } | undefined)?.siteName || (typeof row.site === "string" ? row.site : "") || "";
  const equipment = (row.equipment as { equipmentId?: string } | undefined)?.equipmentId || "";
  const engineer = (row.assignedEngineer as { name?: string } | undefined)?.name || (row.engineer as { name?: string } | undefined)?.name || "";
  const incurredBy = (row.incurredBy as { name?: string } | undefined)?.name || "";
  const visitId = (row.serviceVisit as { visitId?: string } | undefined)?.visitId || "";
  const callId = (row.serviceCall as { callId?: string } | undefined)?.callId || get(row, "callId");
  if (["open-calls", "pending-calls", "closed-calls", "sla", "monthly"].includes(report)) {
    return {
      callId: get(row, "callId"),
      customer,
      site,
      equipment,
      priority: get(row, "priority"),
      engineer,
      status: get(row, "currentStatus") || get(row, "status"),
      complaintDate: get(row, "complaintDate"),
    };
  }
  if (report === "amc") {
    const computed = (row as { computedStatus?: string }).computedStatus || get(row, "status");
    return {
      amcId: get(row, "amcId"),
      customer,
      site,
      amcType: get(row, "amcType"),
      startDate: get(row, "startDate"),
      endDate: get(row, "endDate"),
      status: computed,
      amount: get(row, "contractAmount") || get(row, "amount"),
    };
  }
  if (report === "equipment") {
    return {
      equipmentId: get(row, "equipmentId"),
      assetId: get(row, "assetId"),
      customer,
      site,
      makeModel: [get(row, "make"), get(row, "model")].filter(Boolean).join(" "),
      serialNumber: get(row, "serialNumber"),
      status: get(row, "equipmentStatus") || get(row, "status"),
      serviceCount: get(row, "serviceCount"),
    };
  }
  if (report === "engineer") {
    return {
      name: get(row, "name"),
      email: get(row, "email"),
      assigned: get(row, "assigned"),
      visits: get(row, "visits"),
      completedVisits: get(row, "completedVisits"),
      approvedExpenses: get(row, "approvedExpenses"),
    };
  }
  if (report === "parts") {
    return {
      partId: get(row, "partId"),
      partNumber: get(row, "partNumber"),
      name: get(row, "name"),
      category: get(row, "category"),
      available: get(row, "available"),
      minimumStockLevel: get(row, "minimumStockLevel"),
    };
  }
  if (report === "expenses") {
    return {
      expenseId: get(row, "expenseId"),
      callId,
      visitId,
      incurredBy,
      costSource: get(row, "costSource") || "FIELD",
      category: get(row, "category"),
      amount: get(row, "amount"),
      status: get(row, "status"),
    };
  }
  return row;
}

function formatCell(v: unknown, key: string): string {
  if (v === null || v === undefined || v === "") return "-";
  if (key.toLowerCase().includes("date") && typeof v === "string") {
    const d = new Date(v as string);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
  }
  if (key === "amount" && typeof v === "number") return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v as number);
  if (typeof v === "object") return "-";
  return String(v);
}

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="View and export various reports" />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={report} onValueChange={(v) => setReport(v as ReportType)}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{REPORTS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" placeholder="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" placeholder="To" />
          <Select value={customer || "all"} onValueChange={(v) => setCustomer((v as string) === "all" ? "" : v as string)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Customer" /></SelectTrigger><SelectContent><SelectItem value="all">All Customers</SelectItem>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>)}</SelectContent></Select>
          <Select value={site || "all"} onValueChange={(v) => setSite((v as string) === "all" ? "" : v as string)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Site" /></SelectTrigger><SelectContent><SelectItem value="all">All Sites</SelectItem>{sites.map((s) => <SelectItem key={s._id} value={s._id}>{s.siteName}</SelectItem>)}</SelectContent></Select>
          <Select value={engineer || "all"} onValueChange={(v) => setEngineer((v as string) === "all" ? "" : v as string)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Engineer" /></SelectTrigger><SelectContent><SelectItem value="all">All Engineers</SelectItem>{engineers.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); setCustomer(""); setSite(""); setEngineer(""); }}>Clear</Button>
        </div>
        {summary && (
          <div className="grid gap-2 sm:grid-cols-4">
            {Object.entries(summary).map(([k, v]) => <Card key={k}><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{k}</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{String(v)}</p></CardContent></Card>)}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={exportExcel}>Export Excel</Button>
          <Button size="sm" variant="outline" onClick={exportPdf}>Export PDF</Button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? <EmptyState title="No records" description={`No ${report} records for filters`} /> : (
          <div className="overflow-x-auto">
            <ReportTable report={report} items={items} />
          </div>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>
    </div>
  );
}
