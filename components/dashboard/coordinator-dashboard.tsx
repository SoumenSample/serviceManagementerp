"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/service-calls/status-badge";
import { getPendingSince } from "@/lib/servicecall-helpers";
import Link from "next/link";

export function CoordinatorDashboard({ data }: { data: { service: { open: number; pending: number; overdue: number; unassigned: number; pendingList: { _id: string; callId: string; site?: { siteName: string }; equipment?: { equipmentId: string }; problemDescription: string; assignedEngineer?: { name: string }; createdAt: string; currentStatus: string; nextAction?: string; priority: string }[]; visitsToday: number }; inventory: { pendingPartRequests: number } } }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.open}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unassigned</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.service.unassigned}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{data.service.overdue}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Parts</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.inventory.pendingPartRequests}</p></CardContent></Card>
      </div>
      <Card className="border-l-4">
        <CardHeader><CardTitle>PENDING SERVICE CALLS</CardTitle><CardDescription>Call ID • Site • Equipment • Problem • Engineer • Date • Status • Pending Since • Next Action • Priority</CardDescription></CardHeader>
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
        <Link href="/dashboard/service-calls"><Button size="sm" variant="outline">View Pending Calls</Button></Link>
        <Link href="/dashboard/part-requests"><Button size="sm" variant="outline">Part Requests</Button></Link>
        <Link href="/dashboard/visits"><Button size="sm" variant="outline">Visits Today: {data.service.visitsToday}</Button></Link>
      </div>
    </div>
  );
}
