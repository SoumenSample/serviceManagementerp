"use client";
import { useEffect, useState } from "react";
import { AdminDashboard } from "./admin-dashboard";
import { ManagerDashboard } from "./manager-dashboard";
import { CoordinatorDashboard } from "./coordinator-dashboard";
import { AccountsDashboard } from "./accounts-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DashboardClient({ role }: { role: string }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/summary").then(async (r) => {
      if (!r.ok) throw new Error("Failed to load dashboard");
      setData(await r.json());
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map((i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-24" /><Skeleton className="h-4 w-32 mt-2" /></CardContent></Card>)}</div>;
  if (error) return <Card><CardContent className="pt-6"><p className="text-sm text-destructive">Failed to load dashboard: {error}</p></CardContent></Card>;
  if (!data) return <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No data</p></CardContent></Card>;

  const d = data as unknown as { role: string; master: { totalCustomers: number; totalSites: number; totalEquipment: number; totalEngineers: number }; amc: { active: number; expiring15: number; expiring30: number; expired: number; notBilled: number; invoiced: number; partial: number; paid: number; overdue: number }; service: { open: number; pending: number; closed: number; overdue: number; workCompleted: number; unassigned: number; engineersWithOpen: number; visitsToday: number; pendingList: { _id: string; callId: string; site?: { siteName: string }; equipment?: { equipmentId: string }; problemDescription: string; assignedEngineer?: { name: string }; createdAt: string; currentStatus: string; nextAction?: string; priority: string }[]; avgResponse: number | null; avgResolution: number | null }; inventory: { pendingPartRequests: number; lowStock: number; outOfStock: number }; finance: { totalInvoiced: number; totalPaid: number; outstanding: number; overdueInvoices: number; pendingExpenses: number }; engineer: { todayVisits: number } };

  if (role === "engineer") {
    // Reuse existing engineer stats but show role dashboard wrapper
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">My Assigned</p><p className="text-2xl font-bold">{d.service.open}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold">{d.service.pending}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Today Visits</p><p className="text-2xl font-bold">{d.engineer.todayVisits}</p></CardContent></Card>
        </div>
        <Card><CardContent className="pt-6"><p className="text-sm font-medium">My Pending Calls</p>
          {d.service.pendingList.length === 0 ? <p className="text-sm text-muted-foreground mt-2">No pending calls</p> : <div className="space-y-2 mt-2">{d.service.pendingList.map((c) => <Link key={c._id} href={`/dashboard/service-calls/${c._id}`} className="flex justify-between border rounded p-3"><span className="font-mono text-xs">{c.callId} <Badge variant="outline">{c.currentStatus}</Badge></span><span className="text-xs">{c.site?.siteName}</span></Link>)}</div>}
        </CardContent></Card>
        <div className="flex gap-2">
          <Link href="/dashboard/service-calls"><Button size="sm">My Calls</Button></Link>
          <Link href="/dashboard/visits"><Button size="sm" variant="outline">My Visits</Button></Link>
          <Link href="/dashboard/engineer/profile"><Button size="sm" variant="outline">Profile</Button></Link>
        </div>
      </div>
    );
  }
  if (role === "coordinator") return <CoordinatorDashboard data={d as never} />;
  if (role === "manager") return <ManagerDashboard data={d as never} />;
  if (role === "accounts") return <AccountsDashboard data={d as never} />;
  return <AdminDashboard data={d as never} />;
}
