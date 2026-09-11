"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { LocationTracker } from "@/components/engineer/location-tracker";

type Stats = { assigned: number; pending: number; completed: number; critical: number; todayVisits: number; assignedCalls: { _id: string; callId: string; priority: string; currentStatus: string; site: { siteName: string }; equipment?: { equipmentId: string } }[] };

export default function EngineerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/engineer/stats").then(async (r) => { if (r.ok) setStats(await r.json()); });
  }, []);

  if (!stats) return <div className="p-6 text-sm text-muted-foreground">Loading engineer dashboard...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Engineer Dashboard" description="Mobile-friendly • Today's visits, assigned & critical calls" />
      <LocationTracker />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 "><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Today&apos;s Visits</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.todayVisits}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Assigned Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.assigned}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Calls</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.pending}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.completed}</p></CardContent></Card>
        <Card className="border-destructive/50"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Critical</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{stats.critical}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">My Calls</CardTitle><CardDescription>Assigned & pending — tap to open</CardDescription></CardHeader><CardContent className="space-y-2">
          {stats.assignedCalls.length === 0 ? <p className="text-sm text-muted-foreground">No assigned calls.</p> : stats.assignedCalls.map((c) => (
            <Link key={c._id} href={`/dashboard/service-calls/${c._id}`} className="flex justify-between items-center border rounded-md p-3 hover:bg-muted/50">
              <div><p className="font-mono text-xs font-medium">{c.callId} <Badge variant={c.priority === "CRITICAL" ? "destructive" : "outline"} className="ml-1">{c.priority}</Badge></p><p className="text-xs text-muted-foreground">{c.site?.siteName} {c.equipment?.equipmentId ? `• ${c.equipment.equipmentId}` : ""}</p></div>
              <Badge variant="outline">{c.currentStatus}</Badge>
            </Link>
          ))}
          <Link href="/dashboard/service-calls"><Button variant="outline" size="sm" className="w-full">View All Calls</Button></Link>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard/service-calls"><Button size="sm">My Calls</Button></Link>
          <Link href="/dashboard/visits"><Button size="sm" variant="outline">Visits</Button></Link>
          <Link href="/equipment/qr/placeholder"><Button size="sm" variant="outline">Scan QR</Button></Link>
          <Link href="/dashboard/amc"><Button size="sm" variant="outline">AMC</Button></Link>
        </CardContent></Card>
      </div>

      <div className="flex gap-2 md:hidden">
        <Link href="/dashboard/service-calls" className="flex-1"><Button className="w-full">Home</Button></Link>
        <Link href="/dashboard/visits" className="flex-1"><Button variant="outline" className="w-full">Visits</Button></Link>
      </div>
    </div>
  );
}
