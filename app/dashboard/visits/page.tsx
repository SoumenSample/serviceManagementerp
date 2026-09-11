"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";

type Visit = { _id: string; visitId: string; status: string; visitDate: string; startedAt?: string; completedAt?: string; gpsLatitude?: number; serviceCall: { callId: string; _id: string } | string; engineer: { name: string } };

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    fetch("/api/service-visits?limit=20").then(async (r) => { if (r.ok) setVisits((await r.json()).items); });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Visits" description="Actual ServiceVisits — GPS on start/completion, photos, signatures (not ServiceCalls)" />
      <Card><CardHeader><CardTitle className="text-sm">Recent Visits</CardTitle><CardDescription>Visit ID • Call ID • Engineer • Site • Date • Status • Started/Completed</CardDescription></CardHeader><CardContent className="space-y-2">
        {visits.map((v) => (
          <div key={v._id} className="flex justify-between items-center border rounded-md p-3">
            <div><p className="font-mono text-xs">{v.visitId} <Badge variant={v.status === "COMPLETED" ? "secondary" : v.status === "IN_PROGRESS" ? "default" : "outline"}>{v.status}</Badge> • {(typeof v.serviceCall === "object" ? (v.serviceCall as { callId: string }).callId : v.serviceCall)}</p><p className="text-xs text-muted-foreground">{v.engineer?.name} • {new Date(v.visitDate).toLocaleDateString()} • Started {v.startedAt ? new Date(v.startedAt).toLocaleTimeString() : "—"} • Completed {v.completedAt ? new Date(v.completedAt).toLocaleTimeString() : "—"} • GPS {v.gpsLatitude ? "✓" : "—"}</p></div>
            <Link href={`/dashboard/service-calls/${typeof v.serviceCall === "object" ? (v.serviceCall as { _id: string })._id : v.serviceCall}/visit`}><Button size="sm" variant="outline">Open</Button></Link>
          </div>
        ))}
        {visits.length === 0 && <p className="text-sm text-muted-foreground">No visits yet. Create via Service Call → Add Visit.</p>}
      </CardContent></Card>
    </div>
  );
}
