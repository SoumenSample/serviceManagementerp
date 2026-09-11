import type { AmcStoredStatus } from "@/models/AmcContract";

export type ComputedAmcStatus = "ACTIVE" | "EXPIRING_30" | "EXPIRING_15" | "EXPIRED" | "CANCELLED" | "RENEWED";

export function getDaysRemaining(endDate: Date | string): number {
  const end = new Date(endDate);
  const now = new Date();
  // Normalize to midnight IST (UTC+5:30) — use UTC date diff to avoid off-by-one
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.ceil((end.getTime() - now.getTime()) / msPerDay);
  return diff;
}

export function formatDaysRemaining(days: number): string {
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `${days} days`;
}

export function getComputedAmcStatus(startDate: Date | string, endDate: Date | string, storedStatus: AmcStoredStatus): ComputedAmcStatus {
  if (storedStatus === "CANCELLED") return "CANCELLED";
  if (storedStatus === "RENEWED") return "RENEWED";
  const days = getDaysRemaining(endDate);
  if (days < 0) return "EXPIRED";
  if (days <= 15) return "EXPIRING_15";
  if (days <= 30) return "EXPIRING_30";
  return "ACTIVE";
}

export function getAmcDisplayStatus(computed: ComputedAmcStatus): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (computed) {
    case "ACTIVE": return { label: "ACTIVE", variant: "secondary" };
    case "EXPIRING_30": return { label: "EXPIRING SOON", variant: "outline" };
    case "EXPIRING_15": return { label: "EXPIRING SOON", variant: "destructive" }; // more prominent
    case "EXPIRED": return { label: "EXPIRED", variant: "destructive" };
    case "CANCELLED": return { label: "CANCELLED", variant: "secondary" };
    case "RENEWED": return { label: "RENEWED", variant: "outline" };
    default: return { label: computed, variant: "secondary" };
  }
}

// For dashboard cards — mutually exclusive buckets
export function categorizeForDashboard(daysRemaining: number, storedStatus: AmcStoredStatus) {
  if (storedStatus === "CANCELLED" || storedStatus === "RENEWED") return "other";
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= 15) return "expiring15";
  if (daysRemaining <= 30) return "expiring30";
  return "active";
}
