"use client";
import { Badge } from "@/components/ui/badge";
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "secondary",
    ASSIGNED: "outline",
    VISIT_SCHEDULED: "outline",
    ENGINEER_VISITED: "outline",
    DIAGNOSIS: "outline",
    REPAIR_IN_PROGRESS: "default",
    PARTS_REQUIRED: "destructive",
    PARTS_RECEIVED: "default",
    WORK_COMPLETED: "default",
    CUSTOMER_CONFIRMATION: "outline",
    CLOSED: "secondary",
    ON_HOLD: "secondary",
    CANCELLED: "destructive",
    REOPENED: "destructive",
  };
  return <Badge variant={(map[status] as never) || "secondary"}>{status}</Badge>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  const v = priority === "CRITICAL" ? "destructive" : priority === "HIGH" ? "destructive" : priority === "MEDIUM" ? "outline" : "secondary";
  return <Badge variant={v as never}>{priority}</Badge>;
}
