import type { PartRequestStatus } from "@/models/PartRequest";

export const PART_TRANSITIONS: Record<PartRequestStatus, PartRequestStatus[]> = {
  REQUIRED: ["REQUESTED", "CANCELLED"],
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["DISPATCHED", "REJECTED", "CANCELLED"],
  DISPATCHED: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["USED", "CANCELLED"],
  USED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function isValidPartTransition(from: PartRequestStatus, to: PartRequestStatus): boolean {
  return PART_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getLowStockStatus(available: number, minimum: number): "OUT_OF_STOCK" | "LOW_STOCK" | "AVAILABLE" {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= minimum) return "LOW_STOCK";
  return "AVAILABLE";
}
