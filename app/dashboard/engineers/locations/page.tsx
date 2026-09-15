"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";

type Item = {
  engineer: { _id: string; name: string; email: string; employeeId?: string };
  shift: { shiftId: string; status: string; startedAt: string; endedAt?: string; lastLocationAt?: string; lastLatitude?: number; lastLongitude?: number; lastAddress?: string; lastAccuracy?: number } | null;
  currentCall: { callId: string; currentStatus: string; site?: { siteName: string } } | null;
  freshness: "live"|"stale"|"offline";
  isActive: boolean;
};

function freshnessBadge(f: string) {
  if (f === "live") return <Badge className="bg-green-600">🟢 Live</Badge>;
  if (f === "stale") return <Badge variant="secondary">🟡 Stale</Badge>;
  return <Badge variant="outline">⚪ Offline</Badge>;
}

function todayIST(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function shiftISTDate(shift?: { startedAt: string } | null): string | null {
  if (!shift?.startedAt) return null;
  try {
    return new Date(shift.startedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return null;
  }
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60*1000) return `${Math.floor(diff/1000)} sec ago`;
  if (diff < 3600*1000) return `${Math.floor(diff/60000)} min ago`;
  if (diff < 86400*1000) return `${Math.floor(diff/3600000)} hrs ago`;
  return new Date(dateStr).toLocaleString();
}

export default function EngineerLocationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/engineers/locations");
    if (!res.ok) {
      const j = await res.json().catch(()=>({}));
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setItems(d.items);
    setLoading(false);
  }, []);

  const requestLiveRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Ask all ACTIVE engineers to send fresh location immediately
      // (skip previous-day stale shifts — those engineers are offline)
      const today = todayIST();
      const active = items.filter(i => {
        if (!i.isActive) return false;
        try {
          const d = i.shift ? new Date(i.shift.startedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : null;
          return !d || d >= today;
        } catch {
          return true;
        }
      });
      await Promise.all(active.map(i => fetch(`/api/engineers/${i.engineer._id}/request-location`, { method: "POST" }).catch(()=>{})));
      // Wait 4s for engineers' PWA to capture and post, then reload
      await new Promise(r => setTimeout(r, 4000));
      await load();
    } finally { setRefreshing(false); }
  }, [items, load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 20000); // 20 sec auto-refresh per spec 15-30
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading engineer locations...</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Engineer Locations" description="Live shift tracking — Super Admin / Manager / Coordinator • Auto-refresh 20s" action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>Refresh Now</Button>
          <Button size="sm" onClick={requestLiveRefresh} disabled={refreshing} title="Ask ACTIVE engineers' devices to send current GPS now, then reload">{refreshing ? "Requesting..." : "🔄 Refresh & Request Live Location"}</Button>
        </div>
      } />
      <Card>
        <CardHeader><CardTitle className="text-sm">Engineers — Latest Shift Location</CardTitle><CardDescription>Shows current/latest location per engineer, current assigned Service Call, and freshness. Stale ≠ live.</CardDescription></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Engineer</TableHead><TableHead>Status</TableHead><TableHead>Location</TableHead><TableHead>Updated</TableHead><TableHead>Current Call</TableHead><TableHead>Map</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map(({ engineer, shift, currentCall, freshness, isActive }) => {
                  // Defensive: a shift started on a previous IST date can never be live,
                  // even if the DB row is still ACTIVE (cleanup runs server-side)
                  const shiftDate = shiftISTDate(shift);
                  const isStaleShift = !!(shiftDate && shiftDate < todayIST() && shift?.status === "ACTIVE");
                  const showActive = isActive && !isStaleShift;
                  return (
                  <TableRow key={engineer._id}>
                    <TableCell>
                      <Link href={`/dashboard/engineers/${engineer._id}/location`} className="hover:underline">
                        <p className="font-medium text-sm">{engineer.name}</p>
                        <p className="text-xs text-muted-foreground">{engineer.employeeId || engineer.email}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {showActive ? <Badge className="bg-green-600 w-fit">🟢 Active</Badge> : <Badge variant="outline" title={isStaleShift ? "Shift from a previous day — auto-closed" : undefined}>⚪ Offline</Badge>}
                        <span className="text-[11px] text-muted-foreground">{shift ? new Date(shift.startedAt).toLocaleDateString() : "No shift"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px]">
                      {shift?.lastLatitude ? (
                        <>
                          <p className="truncate" title={shift.lastAddress}>{shift.lastAddress || `${shift.lastLatitude.toFixed(5)}, ${shift.lastLongitude?.toFixed(5)}`}</p>
                          {shift.lastAccuracy && <p className="text-[11px] text-muted-foreground">±{Math.round(shift.lastAccuracy)} m</p>}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {freshnessBadge(freshness)}
                        <span>{shift?.lastLocationAt ? timeAgo(shift.lastLocationAt) : "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {currentCall ? (
                        <Link href={`/dashboard/service-calls/${(currentCall as unknown as { _id?: string })?._id || ""}`} className="hover:underline">
                          <p className="font-mono">{currentCall.callId}</p>
                          <p className="text-muted-foreground">{currentCall.currentStatus} {currentCall.site?.siteName ? `• ${currentCall.site.siteName}` : ""}</p>
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {shift?.lastLatitude && shift?.lastLongitude ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${shift.lastLatitude},${shift.lastLongitude}`} target="_blank" rel="noopener"><Button size="sm" variant="outline">Map</Button></a>
                        ) : "—"}
                        {showActive && (
                          <Button size="sm" variant="secondary" disabled={refreshing} title="Request this engineer to send live GPS now"
                            onClick={async () => {
                              setRefreshing(true);
                              await fetch(`/api/engineers/${engineer._id}/request-location`, { method: "POST" }).catch(()=>{});
                              await new Promise(r => setTimeout(r, 3500));
                              await load();
                              setRefreshing(false);
                            }}>
                            Live
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Live = &lt;2 min, Stale = 2-15 min, Offline = &gt;15 min or no shift. Uses actual stored coordinates.</p>
        </CardContent>
      </Card>
    </div>
  );
}
