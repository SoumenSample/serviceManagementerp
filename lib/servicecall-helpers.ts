import type { ServiceStatus } from "@/models/ServiceCall";

export const STATUS_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  NEW: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["VISIT_SCHEDULED", "ON_HOLD", "CANCELLED"],
  VISIT_SCHEDULED: ["ENGINEER_VISITED", "ON_HOLD", "CANCELLED"],
  ENGINEER_VISITED: ["DIAGNOSIS", "ON_HOLD", "CANCELLED"],
  DIAGNOSIS: ["REPAIR_IN_PROGRESS", "PARTS_REQUIRED", "VISIT_SCHEDULED", "ON_HOLD", "CANCELLED"],
  REPAIR_IN_PROGRESS: ["PARTS_REQUIRED", "WORK_COMPLETED", "VISIT_SCHEDULED", "ON_HOLD", "CANCELLED"],
  PARTS_REQUIRED: ["PARTS_RECEIVED", "ON_HOLD", "CANCELLED"],
  PARTS_RECEIVED: ["VISIT_SCHEDULED", "REPAIR_IN_PROGRESS", "WORK_COMPLETED", "ON_HOLD", "CANCELLED"],
  WORK_COMPLETED: ["CUSTOMER_CONFIRMATION", "VISIT_SCHEDULED", "CANCELLED"],
  CUSTOMER_CONFIRMATION: ["CLOSED", "REOPENED", "CANCELLED"],
  CLOSED: ["REOPENED"],
  ON_HOLD: ["ASSIGNED", "VISIT_SCHEDULED", "DIAGNOSIS", "REPAIR_IN_PROGRESS", "PARTS_REQUIRED", "CANCELLED"],
  CANCELLED: ["REOPENED"],
  REOPENED: ["ASSIGNED", "DIAGNOSIS", "CANCELLED"],
};

export function isValidTransition(from: ServiceStatus, to: ServiceStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const NEXT_ACTIONS: Record<ServiceStatus, string> = {
  NEW: "Assign engineer",
  ASSIGNED: "Schedule visit",
  VISIT_SCHEDULED: "Engineer visit pending",
  ENGINEER_VISITED: "Diagnosis report pending",
  DIAGNOSIS: "Start repair or request parts",
  REPAIR_IN_PROGRESS: "Complete repair",
  PARTS_REQUIRED: "Waiting for parts dispatch",
  PARTS_RECEIVED: "Resume repair",
  WORK_COMPLETED: "Customer confirmation required",
  CUSTOMER_CONFIRMATION: "Close call after confirmation",
  CLOSED: "No action",
  ON_HOLD: "Resume work",
  CANCELLED: "No action",
  REOPENED: "Re-assign and investigate",
};

export function getNextAction(status: ServiceStatus): string {
  return NEXT_ACTIONS[status] || "";
}

export function isOverdue(targetDate?: Date | string): boolean {
  if (!targetDate) return false;
  return new Date(targetDate) < new Date();
}

export function getPendingSince(createdAt: Date | string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export const OPEN_STATUSES: ServiceStatus[] = ["NEW", "ASSIGNED", "VISIT_SCHEDULED", "ENGINEER_VISITED", "DIAGNOSIS", "REPAIR_IN_PROGRESS", "PARTS_REQUIRED", "PARTS_RECEIVED", "WORK_COMPLETED", "CUSTOMER_CONFIRMATION", "ON_HOLD", "REOPENED"];
export const CLOSED_STATUSES: ServiceStatus[] = ["CLOSED", "CANCELLED"];
