export const ROLES = ["super_admin", "manager", "coordinator", "engineer", "accounts"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "site.view",
  "site.create",
  "site.edit",
  "site.delete",
  "customer.view",
  "customer.create",
  "customer.edit",
  "customer.delete",
  "equipment.view",
  "equipment.create",
  "equipment.edit",
  "equipment.delete",
  "serviceCall.view",
  "serviceCall.create",
  "serviceCall.assign",
  "serviceCall.update",
  "serviceCall.close",
  "serviceCall.reopen",
  "parts.view",
  "parts.create",
  "parts.request",
  "parts.approve",
  "parts.dispatch",
  "parts.receive",
  "parts.update",
  "parts.delete",
  "inventory.view",
  "inventory.adjust",
  "inventory.receive",
  "inventory.issue",
  "partRequest.view",
  "partRequest.create",
  "partRequest.approve",
  "partRequest.dispatch",
  "partRequest.receive",
  "partRequest.use",
  "expense.view",
  "expense.create",
  "expense.approve",
  "expense.reject",
  "expense.cancel",
  "finance.view",
  "invoice.view",
  "invoice.create",
  "invoice.update",
  "invoice.cancel",
  "payment.view",
  "payment.create",
  "reports.view",
  "reports.export",
  "users.manage",
  "users.view",
  "users.create",
  "users.update",
  "users.activate",
  "users.deactivate",
  "users.changeRole",
  "amc.view",
  "amc.create",
  "amc.edit",
  "amc.delete",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Centralized RBAC matrix - single source of truth
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  manager: [
    "site.view","site.create","site.edit","site.delete",
    "customer.view","customer.create","customer.edit","customer.delete",
    "equipment.view","equipment.create","equipment.edit","equipment.delete",
    "serviceCall.view","serviceCall.create","serviceCall.assign","serviceCall.update","serviceCall.close","serviceCall.reopen",
    "parts.view","parts.create","parts.request","parts.approve","parts.dispatch","parts.receive","parts.update","parts.delete","inventory.view","inventory.adjust","inventory.receive","inventory.issue","partRequest.view","partRequest.create","partRequest.approve","partRequest.dispatch","partRequest.receive","partRequest.use",
    "expense.view","expense.create","expense.approve","expense.reject","expense.cancel","finance.view","invoice.view","invoice.create","invoice.update","invoice.cancel","payment.view","payment.create",
    "reports.view","reports.export",
    "users.manage",
    "amc.view","amc.create","amc.edit","amc.delete",
    "audit.view",
  ],
  coordinator: [
    "site.view","site.create","site.edit",
    "customer.view","customer.create","customer.edit",
    "equipment.view","equipment.create","equipment.edit",
    "serviceCall.view","serviceCall.create","serviceCall.assign","serviceCall.update","serviceCall.close",
    "parts.view","parts.request","parts.receive","partRequest.view","partRequest.create","partRequest.receive","inventory.view",
    "expense.view","expense.create","expense.approve","expense.reject","expense.cancel",
    "reports.view",
    "amc.view","amc.create","amc.edit",
  ],
  engineer: [
    "site.view",
    "customer.view",
    "equipment.view",
    "serviceCall.view","serviceCall.update",
    "parts.view","parts.request","partRequest.view","partRequest.create",
    "expense.view","expense.create",
    "amc.view",
  ],
  accounts: [
    "site.view",
    "customer.view",
    "equipment.view",
    "serviceCall.view",
    "parts.view",
    "expense.view","expense.create","expense.approve","expense.reject","expense.cancel","finance.view","invoice.view","invoice.create","payment.view","payment.create",
    "reports.view","reports.export",
    "amc.view",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, perms: Permission[]): boolean {
  return perms.some((p) => hasPermission(role, p));
}

// Profile edit hierarchy: super_admin can edit everyone, manager can edit everyone except super_admin
// "other" includes accounts. Coordinator/engineer/accounts can only edit own profile (self).
export function canEditUser(editorRole: Role, targetRole: Role, editorId: string, targetId: string): boolean {
  // Self-edit always allowed (field-level restrictions applied elsewhere)
  if (String(editorId) === String(targetId)) return true;
  if (editorRole === "super_admin") return true;
  if (editorRole === "manager") {
    // manager cannot touch super_admin
    if (targetRole === "super_admin") return false;
    // manager can edit manager, coordinator, engineer, accounts
    return (["manager", "coordinator", "engineer", "accounts"] as Role[]).includes(targetRole);
  }
  // coordinator, engineer, accounts, etc. cannot edit other users' profiles
  return false;
}

export function canCreateUser(creatorRole: Role, newRole: Role): boolean {
  if (creatorRole === "super_admin") return true;
  if (newRole === "super_admin") return false; // only super_admin can create super_admin
  if (creatorRole === "manager") return (["manager", "coordinator", "engineer", "accounts"] as Role[]).includes(newRole);
  return false;
}
