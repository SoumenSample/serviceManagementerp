"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";

export default function FinanceDashboard() {
  const [data, setData] = useState<{ revenue: { totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }; expenses: { pendingApproval: number; totalApproved: number; monthTotal: number; parts: number; travel: number; labour: number; other: number } } | null>(null);
  useEffect(() => { fetch("/api/finance/summary").then(async (r) => { if (r.ok) setData(await r.json()); }); }, []);
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading finance summary...</div>;
  return (
    <div className="space-y-6">
      <PageHeader title="Finance Dashboard" description="Revenue vs Expenses • outstanding/overdue derived from dueDate" />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Invoiced</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.revenue.totalInvoiced)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.revenue.totalPaid)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.revenue.outstanding)}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{inr(data.revenue.overdue)}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Approval</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.expenses.pendingApproval}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Approved</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.expenses.totalApproved)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Month Service Cost</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.expenses.monthTotal)}</p><p className="text-xs text-muted-foreground">Parts {inr(data.expenses.parts)} • Travel {inr(data.expenses.travel)} • Labour {inr(data.expenses.labour)} • Other {inr(data.expenses.other)}</p></CardContent></Card>
      </div>
    </div>
  );
}
