import { OPEN_STATUSES, CLOSED_STATUSES, getPendingSince } from "./servicecall-helpers";
import { getComputedAmcStatus } from "./amc-helpers";
import type { Role } from "./rbac";

export const REPORT_TYPES = ["open-calls","pending-calls","closed-calls","amc","equipment","engineer","parts","expenses","monthly","sla"] as const;

export function buildDateFilter(from?: string, to?: string, field = "createdAt") {
  if (!from && !to) return {};
  const f: Record<string, unknown> = {};
  if (from) (f.$gte as unknown) = new Date(from);
  if (to) (f.$lte as unknown) = new Date(to);
  if (Object.keys(f).length) return { [field]: f };
  return {};
}

export function getServiceCallFilter(type: string, base: Record<string, unknown>) {
  if (type === "open-calls") return { ...base, currentStatus: { $in: OPEN_STATUSES.filter(s => s !== "CANCELLED") } };
  if (type === "pending-calls") return { ...base, currentStatus: { $in: OPEN_STATUSES } };
  if (type === "closed-calls") return { ...base, currentStatus: { $in: CLOSED_STATUSES } };
  return base;
}

export function applyRoleScope(role: Role, userId: string, filter: Record<string, unknown>, allowEngineerScope: boolean) {
  if (role === "engineer" && allowEngineerScope) {
    // Engineer sees only their assigned calls or their visits; for ServiceCall reports, scope to assignedEngineer
    return { ...filter, assignedEngineer: userId };
  }
  return filter;
}

export function engineerScopedQuery(role: Role, userId: string) {
  if (role === "engineer") return { engineer: userId };
  return {};
}
