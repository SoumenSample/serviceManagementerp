"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AccountsDashboard({ data }: { data: { finance: { totalInvoiced: number; totalPaid: number; outstanding: number; overdueInvoices: number; pendingExpenses: number }; amc: { notBilled: number; invoiced: number; partial: number; paid: number; overdue: number } } }) {
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Invoiced</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.finance.totalInvoiced)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.finance.totalPaid)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inr(data.finance.outstanding)}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue Invoices</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{data.finance.overdueInvoices}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">AMC Not Billed</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.amc.notBilled}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Invoiced</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.amc.invoiced}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Partial</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.amc.partial}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paid</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.amc.paid}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-destructive">{data.amc.overdue}</p></CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/invoices"><Button size="sm">Create Invoice</Button></Link>
        <Link href="/dashboard/finance"><Button size="sm" variant="outline">Finance Dashboard</Button></Link>
        <Link href="/dashboard/expenses"><Button size="sm" variant="outline">Review Expenses: {data.finance.pendingExpenses} pending</Button></Link>
      </div>
    </div>
  );
}
