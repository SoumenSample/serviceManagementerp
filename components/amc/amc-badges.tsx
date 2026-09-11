"use client";
import { Badge } from "@/components/ui/badge";
import { getComputedAmcStatus, getAmcDisplayStatus, getDaysRemaining, formatDaysRemaining } from "@/lib/amc-helpers";

export function AmcStatusBadge({ startDate, endDate, storedStatus }: { startDate: string; endDate: string; storedStatus: string }) {
  const computed = getComputedAmcStatus(startDate, endDate, storedStatus as never);
  const { label, variant } = getAmcDisplayStatus(computed);
  return <Badge variant={variant}>{label}</Badge>;
}
export function PaymentStatusBadge({ status }: { status: string }) {
  const variant = status === "PAID" ? "default" : status === "OVERDUE" ? "destructive" : status === "PARTIAL" ? "outline" : "secondary";
  return <Badge variant={variant as never}>{status}</Badge>;
}
export function AmcTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = { COMPREHENSIVE: "Comprehensive", NON_COMPREHENSIVE: "Non-Comprehensive", PREVENTIVE_MAINTENANCE: "Preventive Maintenance", OTHER: "Other" };
  return <Badge variant="outline">{labels[type] || type}</Badge>;
}
export function DaysRemainingBadge({ endDate, storedStatus, startDate }: { endDate: string; storedStatus: string; startDate: string }) {
  const computed = getComputedAmcStatus(startDate, endDate, storedStatus as never);
  if (computed === "CANCELLED" || computed === "RENEWED") return <Badge variant="secondary">{computed}</Badge>;
  const days = getDaysRemaining(endDate);
  const text = formatDaysRemaining(days);
  const variant = days < 0 ? "destructive" : days <= 15 ? "destructive" : days <= 30 ? "outline" : "secondary";
  return <Badge variant={variant as never}>{text}</Badge>;
}
