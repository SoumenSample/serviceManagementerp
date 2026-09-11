"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/service-calls/status-badge";
import { getPendingSince } from "@/lib/servicecall-helpers";
import Link from "next/link";

export function AdminDashboard({ data }: { data: { master: { totalCustomers: number; totalSites: number; totalEquipment: number }; amc: { active: number; expiring15: number; expiring30: number; expired: number }; service: { open: number; pending: number; closed: number; overdue: number; workCompleted: number; pendingList: { _id: string; callId: string; site?: { siteName: string }; equipment?: { equipmentId: string }; problemDescription: string; assignedEngineer?: { name: string }; createdAt: string; currentStatus: string; nextAction?: string; priority: string; targetVisitDate?: string }[]; avgResponse: number | null; avgResolution: number | null }; inventory: { pendingPartRequests: number; lowStock: number; outOfStock: number }; finance: { outstanding: number; overdueInvoices: number; pendingExpenses: number } } }) {
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Customers</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.master.totalCustomers}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Sites</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.master.totalSites}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Equipment</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.master.totalEquipment}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active AMC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.amc.active}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring 15 Days</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{data.amc.expiring15}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring 30 Days</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.amc.expiring30}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expired</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.amc.expired}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {/* <Card className="border-l-4 border-l-primary"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.open}</p></CardContent></Card> */}
        <Card className="border-l-4"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.open}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.pending}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{data.service.overdue}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Work Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.workCompleted}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Part Requests</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.inventory.pendingPartRequests}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Low Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.inventory.lowStock}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Out of Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{data.inventory.outOfStock}</p></CardContent></Card>
      </div>
      <PendingCallsSection pendingList={data.service.pendingList} />
      <SLASection overdue={data.service.overdue} avgResponse={data.service.avgResponse} avgResolution={data.service.avgResolution} />
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/customers"><Button size="sm">Add Customer</Button></Link>
        <Link href="/dashboard/amc/new"><Button size="sm" variant="outline">New AMC</Button></Link>
        <Link href="/dashboard/service-calls/new"><Button size="sm" variant="outline">New Service Call</Button></Link>
        <Link href="/dashboard/users"><Button size="sm" variant="outline">Add User</Button></Link>
      </div>
    </div>
  );
}

function PendingCallsSection({ pendingList }: { pendingList: { _id: string; callId: string; site?: { siteName: string }; equipment?: { equipmentId: string }; problemDescription: string; assignedEngineer?: { name: string }; createdAt: string; currentStatus: string; nextAction?: string; priority: string; targetVisitDate?: string }[] }) {
  if (!pendingList.length) return <Card><CardHeader><CardTitle className="text-sm">PENDING SERVICE CALLS</CardTitle><CardDescription>No pending calls</CardDescription></CardHeader></Card>;
  return (
    <Card className="border-l-4 ">
      <CardHeader><CardTitle>PENDING SERVICE CALLS</CardTitle><CardDescription>Call ID • Site • Equipment • Problem • Engineer • Status • Pending Since • Next Action • Priority</CardDescription></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Call ID</TableHead><TableHead>Site</TableHead><TableHead>Equipment</TableHead><TableHead>Problem</TableHead><TableHead>Engineer</TableHead><TableHead>Status</TableHead><TableHead>Pending Since</TableHead><TableHead>Next Action</TableHead><TableHead>Priority</TableHead></TableRow></TableHeader>
          <TableBody>{pendingList.map((c: { _id: string; callId: string; site?: { siteName: string }; equipment?: { equipmentId: string }; problemDescription: string; assignedEngineer?: { name: string }; createdAt: string; currentStatus: string; nextAction?: string; priority: string }) => (
            <TableRow key={c._id} className={c.priority === "CRITICAL" ? "bg-destructive/5" : ""}>
              <TableCell className="font-mono text-xs">{c.callId}</TableCell><TableCell className="text-xs">{c.site?.siteName || "-"}</TableCell><TableCell className="font-mono text-xs">{c.equipment?.equipmentId || "-"}</TableCell><TableCell className="text-xs max-w-[150px] truncate">{c.problemDescription}</TableCell><TableCell className="text-xs">{c.assignedEngineer?.name || "Unassigned"}</TableCell><TableCell><StatusBadge status={c.currentStatus} /></TableCell><TableCell className="text-xs">{getPendingSince(c.createdAt)}</TableCell><TableCell className="text-xs max-w-[120px] truncate">{c.nextAction}</TableCell><TableCell><PriorityBadge priority={c.priority} /></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SLASection({ overdue, avgResponse, avgResolution }: { overdue: number; avgResponse: number | null; avgResolution: number | null }) {
  return (
    <Card><CardHeader><CardTitle className="text-sm">SLA Summary</CardTitle><CardDescription>Overdue • Avg Response (complaint→visit) • Avg Resolution (complaint→closed)</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-4 text-sm">
      <div><p className="text-muted-foreground">Overdue Calls</p><p className="text-xl font-bold text-destructive">{overdue}</p></div>
      <div><p className="text-muted-foreground">Avg Response</p><p className="text-xl font-bold">{avgResponse !== null ? `${avgResponse.toFixed(1)} days` : "—"}</p></div>
      <div><p className="text-muted-foreground">Avg Resolution</p><p className="text-xl font-bold">{avgResolution !== null ? `${avgResolution.toFixed(1)} days` : "—"}</p></div>
    </CardContent></Card>
  );
}
