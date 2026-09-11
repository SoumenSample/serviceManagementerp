"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TimelineEvent = {
  type: string;
  timestamp: string;
  description: string;
  action?: string;
  module?: string;
  actor?: string;
  data?: unknown;
};

export function ActivityTimeline({ serviceCallId }: { serviceCallId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/service-calls/${serviceCallId}/activity`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Failed to load activity");
        }
        const d = await r.json();
        setEvents(d.timeline || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [serviceCallId]);

  if (loading) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading activity...</CardContent></Card>;
  if (error) return <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>;
  if (events.length === 0) return <Card><CardContent className="p-4 text-sm text-muted-foreground">No activity yet</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Activity Timeline</CardTitle><CardDescription>Chronological — AuditLog + Visits + Status/Assignment history</CardDescription></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((e, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${e.type === "AUDIT" ? "bg-primary" : e.type === "SERVICE_VISIT" ? "bg-blue-500" : e.type === "STATUS_HISTORY" ? "bg-orange-500" : "bg-muted-foreground"}`} />
                {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{e.description}</span>
                  {e.action && <Badge variant="outline" className="text-[10px]">{e.action}</Badge>}
                  {e.module && <Badge variant="secondary" className="text-[10px]">{e.module}</Badge>}
                  {e.type !== "AUDIT" && <Badge variant="outline" className="text-[10px]">{e.type}</Badge>}
                </div>
                <div className="flex gap-2 text-[11px] text-muted-foreground mt-1">
                  <span>{new Date(e.timestamp).toLocaleString()}</span>
                  {e.actor && <span>• {e.actor}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
