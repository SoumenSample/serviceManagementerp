export const EXPENSE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: [],
  REJECTED: ["SUBMITTED", "CANCELLED"],
  CANCELLED: [],
};

export function isValidExpenseTransition(from: string, to: string): boolean {
  return EXPENSE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isOverdue(dueDate?: Date | string, outstanding?: number): boolean {
  if (!dueDate || !outstanding || outstanding <= 0) return false;
  return new Date(dueDate) < new Date();
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
