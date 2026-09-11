// AUDIT FEATURE TEMPORARILY HIDDEN — file preserved, route hidden per request
// @ts-nocheck
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { AuditLog, AUDIT_ACTIONS, AUDIT_MODULES } from "@/models/AuditLog";

// AUDIT FEATURE TEMPORARILY HIDDEN — not deleted, just commented/hidden per request
// To re-enable, remove the early return below and restore audit.view check
export async function GET(req: Request) {
  // TEMPORARILY HIDDEN
  return NextResponse.json({ items: [], total: 0, page: 1, limit: 50, totalPages: 0, hidden: true, message: "Audit logs temporarily hidden" });
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "audit.view")) return NextResponse.json({ error: "Forbidden: audit.view required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const skip = (page - 1) * limit;

  const action = searchParams.get("action");
  const module = searchParams.get("module");
  const actor = searchParams.get("actor");
  const recordId = searchParams.get("recordId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim();

  await connectDB();
  const filter: Record<string, unknown> = {};

  if (action && (AUDIT_ACTIONS as readonly string[]).includes(action)) filter.action = action;
  if (module && (AUDIT_MODULES as readonly string[]).includes(module)) filter.module = module;
  if (actor) filter.actor = actor;
  if (recordId) filter.recordId = recordId;
  if (from || to) {
    const range: Record<string, unknown> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    filter.createdAt = range;
  }
  if (search) {
    // safe regex search on description and recordId
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ description: regex }, { recordId: regex }, { auditId: regex }];
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}
