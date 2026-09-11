"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";

export default function EngineerLocationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<{ engineer: { name: string; email: string; employeeId?: string }; shift: { shiftId: string; status: string; startedAt: string; endedAt?: string; lastLocationAt?: string; lastLatitude?: number; lastLongitude?: number; lastAddress?: string; lastAccuracy?: number } | null; latest: { latitude: number; longitude: number; accuracy?: number; address?: string; city?: string; state?: string; country?: string; capturedAt: string } | null; currentCall: { callId: string; currentStatus: string; site?: { siteName: string }; customer?: { companyName: string } } | null; history: { latitude: number; longitude: number; capturedAt: string; address?: string }[] } | null>(null);

  useEffect(() => {
    fetch(`/api/engineers/${id}/location`).then(async (r) => { if (r.ok) setData(await r.json()); });
  }, [id]);

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading location detail...</div>;
  const { engineer, shift, latest, currentCall } = data;
  const isActive = shift?.status === "ACTIVE";
  const last = latest || (shift?.lastLatitude ? { latitude: shift.lastLatitude, longitude: shift.lastLongitude!, accuracy: shift.lastAccuracy, address: shift.lastAddress, capturedAt: shift.lastLocationAt! } : null);

  return (
    <div className="space-y-6">
      <PageHeader title={`${engineer.name} — Location`} description={`${engineer.employeeId || engineer.email} • Shift ${shift?.shiftId || "—"}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Engineer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{engineer.name}</p>
            <p className="text-muted-foreground text-xs">{engineer.email}</p>
            <p><Badge className={isActive ? "bg-green-600" : ""}>{isActive ? "🟢 Active" : "⚪ Offline/Ended"}</Badge></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Shift</CardTitle><CardDescription>{shift ? `Started ${new Date(shift.startedAt).toLocaleString()}` : "No shift"}</CardDescription></CardHeader>
          <CardContent className="text-sm">
            {shift ? (
              <>
                <p>Status: <Badge variant={isActive ? "default" : "outline"}>{shift.status}</Badge></p>
                {shift.endedAt && <p className="text-xs text-muted-foreground">Ended: {new Date(shift.endedAt).toLocaleString()}</p>}
              </>
            ) : <p className="text-muted-foreground">No shift recorded</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Latest Location</CardTitle><CardDescription>{last ? `Captured ${new Date(last.capturedAt).toLocaleString()}` : "No location yet"}</CardDescription></CardHeader>
        <CardContent className="text-sm space-y-2">
          {last ? (
            <>
              <p className="font-medium">{last.address || `${last.latitude.toFixed(5)}, ${last.longitude.toFixed(5)}`}</p>
              <p className="text-xs text-muted-foreground">Coordinates: {last.latitude.toFixed(6)}, {last.longitude.toFixed(6)}</p>
              {last.accuracy && <p className="text-xs">Accuracy: ±{Math.round(last.accuracy)} m</p>}
              {last.city && <p className="text-xs text-muted-foreground">{[last.city, (last as unknown as { state?: string }).state, (last as unknown as { country?: string }).country].filter(Boolean).join(", ")}</p>}
              <div className="flex gap-2 pt-2">
                <a href={`https://www.google.com/maps/search/?api=1&query=${last.latitude},${last.longitude}`} target="_blank" rel="noopener"><Button size="sm">View on Google Maps</Button></a>
                <a href={`https://www.openstreetmap.org/?mlat=${last.latitude}&mlon=${last.longitude}#map=16/${last.latitude}/${last.longitude}`} target="_blank" rel="noopener"><Button size="sm" variant="outline">OSM Map</Button></a>
              </div>
              <div className="rounded-md overflow-hidden border mt-3">
                <iframe
                  title="map"
                  width="100%"
                  height="280"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${last.longitude - 0.005},${last.latitude - 0.005},${last.longitude + 0.005},${last.latitude + 0.005}&layer=mapnik&marker=${last.latitude},${last.longitude}`}
                />
              </div>
            </>
          ) : <p className="text-muted-foreground">No coordinates — address unavailable will show when available.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Current Service Call</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {currentCall ? (
            <div>
              <p className="font-mono font-medium">{currentCall.callId} <Badge variant="outline">{currentCall.currentStatus}</Badge></p>
              <p className="text-muted-foreground text-xs">{currentCall.customer?.companyName || ""} {currentCall.site?.siteName ? `• ${currentCall.site.siteName}` : ""}</p>
              <Link href={`/dashboard/service-calls/${(currentCall as unknown as { _id: string })._id || ""}`}><Button size="sm" variant="outline" className="mt-2">Open Call</Button></Link>
            </div>
          ) : <p className="text-muted-foreground">No active assigned ServiceCall</p>}
        </CardContent>
      </Card>

      <Link href="/dashboard/engineers/locations"><Button variant="outline" size="sm">Back to Locations</Button></Link>
    </div>
  );
}
