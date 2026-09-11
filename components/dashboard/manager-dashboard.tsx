"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/service-calls/status-badge";
import { getPendingSince } from "@/lib/servicecall-helpers";
import Link from "next/link";

export function ManagerDashboard({ data }: { data: { service: { open: number; pending: number; overdue: number; closed: number; workCompleted: number; unassigned: number; engineersWithOpen: number; visitsToday: number; pendingList: { _id: string; callId: string; site?: { siteName: string }; equipment?: { equipmentId: string }; problemDescription: string; assignedEngineer?: { name: string }; createdAt: string; currentStatus: string; nextAction?: string; priority: string }[] }; amc: { active: number; expiring15: number; expiring30: number; expired: number }; inventory: { pendingPartRequests: number; lowStock: number; outOfStock: number }; finance: { outstanding: number; overdueInvoices: number; pendingExpenses: number }; master: { totalEngineers: number } } }) {
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.open}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.pending}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{data.service.overdue}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Closed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.closed}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Engineers</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.master.totalEngineers}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Engineers With Open</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.engineersWithOpen}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unassigned Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.unassigned}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Visits Today</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.visitsToday}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active AMC</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.amc.active}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring 15</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-destructive">{data.amc.expiring15}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring 30</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.amc.expiring30}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{inr(data.finance.outstanding)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Low Stock</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{data.inventory.lowStock}</p></CardContent></Card>
      </div>
      <Card className="border-l-4 ">
        <CardHeader><CardTitle>PENDING SERVICE CALLS</CardTitle><CardDescription>Priority & overdue highlighted</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.service.pendingList.length === 0 ? <p className="text-sm text-muted-foreground">No pending calls</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Call ID</TableHead><TableHead>Site</TableHead><TableHead>Equipment</TableHead><TableHead>Problem</TableHead><TableHead>Engineer</TableHead><TableHead>Status</TableHead><TableHead>Pending Since</TableHead><TableHead>Next Action</TableHead><TableHead>Priority</TableHead></TableRow></TableHeader>
              <TableBody>{data.service.pendingList.map((c) => <TableRow key={c._id}><TableCell className="font-mono text-xs">{c.callId}</TableCell><TableCell>{c.site?.siteName || "-"}</TableCell><TableCell className="font-mono text-xs">{c.equipment?.equipmentId || "-"}</TableCell><TableCell className="max-w-[150px] truncate text-xs">{c.problemDescription}</TableCell><TableCell>{c.assignedEngineer?.name || "Unassigned"}</TableCell><TableCell><StatusBadge status={c.currentStatus} /></TableCell><TableCell>{getPendingSince(c.createdAt)}</TableCell><TableCell className="max-w-[120px] truncate text-xs">{c.nextAction}</TableCell><TableCell><PriorityBadge priority={c.priority} /></TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/service-calls/new"><Button size="sm">New Service Call</Button></Link>
        <Link href="/dashboard/service-calls"><Button size="sm" variant="outline">Pending Calls</Button></Link>
        <Link href="/dashboard/amc"><Button size="sm" variant="outline">View AMC</Button></Link>
        <Link href="/dashboard/inventory"><Button size="sm" variant="outline">Inventory</Button></Link>
      </div>
    </div>
  );
}
