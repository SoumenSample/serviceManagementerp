import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";
import { AmcContract } from "@/models/AmcContract";
import { Equipment } from "@/models/Equipment";
import { User } from "@/models/User";
import { Part } from "@/models/Part";
import { Inventory } from "@/models/Inventory";
import { PartRequest } from "@/models/PartRequest";
import { ServiceExpense } from "@/models/ServiceExpense";
import { getComputedAmcStatus } from "@/lib/amc-helpers";
import { OPEN_STATUSES, CLOSED_STATUSES } from "@/lib/servicecall-helpers";

const MAX_LIMIT = 100;
const EXPORT_MAX = 5000;

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "reports.view")) return NextResponse.json({ error: "Forbidden reports.view" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const report = searchParams.get("report") || "open-calls";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const customer = searchParams.get("customer") || undefined;
  const site = searchParams.get("site") || undefined;
  const engineer = searchParams.get("engineer") || undefined;

  await connectDB();

  // Role scoping for engineer
  const isEngineer = auth!.role === "engineer";
  const effectiveEngineer = isEngineer ? String(auth!.sub) : engineer;

  // Helper to build base serviceCall filter with date
  function baseSCFilter() {
    const f: Record<string, unknown> = {};
    if (from || to) {
      const d: Record<string, unknown> = {};
      if (from) (d.$gte as unknown) = new Date(from);
      if (to) (d.$lte as unknown) = new Date(to);
      f.complaintDate = d;
    }
    if (customer) f.customer = customer;
    if (site) f.site = site;
    if (effectiveEngineer) f.assignedEngineer = effectiveEngineer;
    // Engineer cannot override to another engineer
    if (isEngineer && engineer && engineer !== String(auth!.sub)) return { __forbidden: true };
    return f;
  }

  if (["open-calls", "pending-calls", "closed-calls", "sla", "monthly"].includes(report)) {
    const base = baseSCFilter();
    if ((base as { __forbidden?: boolean }).__forbidden) return NextResponse.json({ error: "Forbidden engineer scope" }, { status: 403 });
    let statusFilter: Record<string, unknown> = {};
    if (report === "open-calls") statusFilter = { currentStatus: { $in: OPEN_STATUSES.filter(s => s !== "CANCELLED") } };
    else if (report === "pending-calls") statusFilter = { currentStatus: { $in: OPEN_STATUSES } };
    else if (report === "closed-calls") statusFilter = { currentStatus: { $in: CLOSED_STATUSES } };
    else if (report === "sla") statusFilter = {};
    const filter = { ...base, ...statusFilter };

    // For monthly, we need aggregation by month but also return rows for selected month
    if (report === "monthly") {
      const year = searchParams.get("year") || String(new Date().getFullYear());
      const month = searchParams.get("month") || "";
      const monthFilter: Record<string, unknown> = { ...base };
      if (month) {
        const start = new Date(`${year}-${month.padStart(2, "0")}-01`);
        const end = new Date(start); end.setMonth(end.getMonth() + 1);
        monthFilter.complaintDate = { $gte: start, $lt: end };
      } else if (year) {
        monthFilter.complaintDate = { $gte: new Date(`${year}-01-01`), $lt: new Date(`${Number(year) + 1}-01-01`) };
      }
      const [items, total, visitsTotal, closedCount] = await Promise.all([
        ServiceCall.find(monthFilter).populate("customer", "companyName").populate("site", "siteName").populate("assignedEngineer", "name").sort({ complaintDate: -1 }).skip(skip).limit(limit).lean(),
        ServiceCall.countDocuments(monthFilter),
        ServiceVisit.countDocuments(isEngineer ? { engineer: auth!.sub } : {}),
        ServiceCall.countDocuments({ ...monthFilter, currentStatus: "CLOSED" }),
      ]);
      const summary = { total, closed: closedCount, visits: visitsTotal };
      return NextResponse.json({ report, items, total, page, limit, totalPages: Math.ceil(total / limit), summary });
    }

    if (report === "sla") {
      const items = await ServiceCall.find(filter).populate("customer", "companyName").populate("site", "siteName").populate("equipment", "equipmentId").populate("assignedEngineer", "name").sort({ complaintDate: -1 }).skip(skip).limit(limit).lean();
      const enriched = (items as unknown as { complaintDate: string; targetVisitDate?: string; actualVisitDate?: string; actualResolutionDate?: string; priority: string }[]).map((r) => {
        const complaint = new Date(r.complaintDate).getTime();
        const target = r.targetVisitDate ? new Date(r.targetVisitDate).getTime() : null;
        const actualVisit = r.actualVisitDate ? new Date(r.actualVisitDate).getTime() : null;
        const breached = target && actualVisit ? actualVisit > target : target ? Date.now() > target && !actualVisit : false;
        const resolutionDays = r.actualResolutionDate ? (new Date(r.actualResolutionDate).getTime() - complaint) / (1000 * 60 * 60 * 24) : null;
        return { ...r, slaBreached: breached, resolutionDays: resolutionDays !== null ? Number(resolutionDays.toFixed(1)) : null };
      });
      const total = await ServiceCall.countDocuments(filter);
      const breachedCount = enriched.filter((e) => e.slaBreached).length;
      return NextResponse.json({ report, items: enriched, total, page, limit, totalPages: Math.ceil(total / limit), summary: { total, breached: breachedCount, within: total - breachedCount } });
    }

    const [items, total] = await Promise.all([
      ServiceCall.find(filter).populate("customer", "companyName").populate("site", "siteName").populate("equipment", "equipmentId serialNumber").populate("assignedEngineer", "name").sort({ complaintDate: -1 }).skip(skip).limit(limit).lean(),
      ServiceCall.countDocuments(filter),
    ]);
    const summaryBase = { total };
    if (report === "open-calls" || report === "pending-calls") {
      const critical = await ServiceCall.countDocuments({ ...filter, priority: "CRITICAL" });
      const overdue = await ServiceCall.countDocuments({ ...filter, targetVisitDate: { $lt: new Date() } });
      return NextResponse.json({ report, items, total, page, limit, totalPages: Math.ceil(total / limit), summary: { ...summaryBase, critical, overdue } });
    }
    return NextResponse.json({ report, items, total, page, limit, totalPages: Math.ceil(total / limit), summary: summaryBase });
  }

  if (report === "amc") {
    const amcFilter: Record<string, unknown> = {};
    if (customer) amcFilter.customer = customer;
    if (site) amcFilter.site = site;
    if (effectiveEngineer) amcFilter.assignedEngineer = effectiveEngineer;
    if (isEngineer && engineer && engineer !== String(auth!.sub)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const amcType = searchParams.get("amcType");
    const amcStatus = searchParams.get("amcStatus");
    const paymentStatus = searchParams.get("paymentStatus");
    if (amcType) amcFilter.amcType = amcType;
    if (paymentStatus) amcFilter.paymentStatus = paymentStatus;
    // Fetch then compute status
    const all = await AmcContract.find(amcFilter).populate("customer", "companyName").populate("site", "siteName").lean();
    let filtered = all as unknown as { startDate: string; endDate: string; status: string }[];
    if (amcStatus) filtered = filtered.filter((a) => getComputedAmcStatus(a.startDate, a.endDate, a.status as never) === amcStatus);
    const total = filtered.length;
    const paged = filtered.slice(skip, skip + limit);
    const summary = {
      total: all.length,
      active: all.filter((a) => getComputedAmcStatus(a.startDate, a.endDate, a.status as never) === "ACTIVE").length,
      expiring15: all.filter((a) => getComputedAmcStatus(a.startDate, a.endDate, a.status as never) === "EXPIRING_15").length,
      expiring30: all.filter((a) => getComputedAmcStatus(a.startDate, a.endDate, a.status as never) === "EXPIRING_30").length,
      expired: all.filter((a) => getComputedAmcStatus(a.startDate, a.endDate, a.status as never) === "EXPIRED").length,
    };
    return NextResponse.json({ report, items: paged, total, page, limit, totalPages: Math.ceil(total / limit), summary });
  }

  if (report === "equipment") {
    const eqFilter: Record<string, unknown> = {};
    if (customer) eqFilter.customer = customer;
    if (site) eqFilter.site = site;
    if (searchParams.get("make")) eqFilter.make = searchParams.get("make");
    const items = await Equipment.find(eqFilter).populate("customer", "companyName").populate("site", "siteName").sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Equipment.countDocuments(eqFilter);
    // Enrich with service call counts per equipment (efficient per page)
    const ids = items.map((e) => e._id);
    const counts = await ServiceCall.aggregate([{ $match: { equipment: { $in: ids } } }, { $group: { _id: "$equipment", count: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const enriched = items.map((e) => ({ ...e, serviceCount: countMap.get(String(e._id)) || 0 }));
    return NextResponse.json({ report, items: enriched, total, page, limit, totalPages: Math.ceil(total / limit), summary: { total } });
  }

  if (report === "engineer") {
    const users = await User.find({ role: "engineer", isActive: true }).select("name email").lean();
    const rows = [];
    for (const u of users) {
      if (isEngineer && String(u._id) !== String(auth!.sub)) continue;
      const assigned = await ServiceCall.countDocuments({ assignedEngineer: u._id });
      const visits = await ServiceVisit.countDocuments({ engineer: u._id });
      const completedVisits = await ServiceVisit.countDocuments({ engineer: u._id, status: "COMPLETED" });
      const approvedExpenses = await ServiceExpense.countDocuments({ incurredBy: u._id, status: "APPROVED" });
      rows.push({ _id: u._id, name: u.name, email: u.email, assigned, visits, completedVisits, approvedExpenses });
    }
    const total = rows.length;
    const paged = rows.slice(skip, skip + limit);
    return NextResponse.json({ report, items: paged, total, page, limit, totalPages: Math.ceil(total / limit), summary: { totalEngineers: total } });
  }

  if (report === "parts") {
    const partFilter: Record<string, unknown> = {};
    const category = searchParams.get("category");
    if (category) partFilter.category = category;
    const parts = await Part.find(partFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Part.countDocuments(partFilter);
    // Enrich inventory
    const invs = await Inventory.find({ part: { $in: parts.map((p) => p._id) } }).lean();
    const invMap = new Map(invs.map((i) => [String(i.part), i]));
    const enriched = parts.map((p) => {
      const inv = invMap.get(String(p._id)) as unknown as { quantityOnHand: number; quantityReserved: number } | undefined;
      const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
      return { ...p, inventory: inv, available };
    });
    // Also part requests summary
    const pendingRequests = await PartRequest.countDocuments({ status: { $in: ["REQUIRED", "REQUESTED", "APPROVED"] } });
    return NextResponse.json({ report, items: enriched, total, page, limit, totalPages: Math.ceil(total / limit), summary: { total, pendingRequests } });
  }

  if (report === "expenses") {
    const expFilter: Record<string, unknown> = {};
    if (customer) expFilter.customer = customer;
    if (site) expFilter.site = site;
    if (searchParams.get("category")) expFilter.category = searchParams.get("category");
    if (searchParams.get("costSource")) expFilter.costSource = searchParams.get("costSource");
    if (searchParams.get("status")) expFilter.status = searchParams.get("status");
    if (isEngineer) expFilter.incurredBy = auth!.sub;
    else if (engineer) expFilter.incurredBy = engineer;
    if (from || to) {
      const d: Record<string, unknown> = {};
      if (from) (d.$gte as unknown) = new Date(from);
      if (to) (d.$lte as unknown) = new Date(to);
      expFilter.expenseDate = d;
    }
    const [items, total] = await Promise.all([
      ServiceExpense.find(expFilter).populate("serviceCall", "callId").populate("incurredBy", "name").populate("serviceVisit", "visitId").sort({ expenseDate: -1 }).skip(skip).limit(limit).lean(),
      ServiceExpense.countDocuments(expFilter),
    ]);
    const all = await ServiceExpense.find(expFilter).lean() as unknown as { amount: number; costSource: string; status: string }[];
    const summary = {
      total,
      approved: all.filter((e) => e.status === "APPROVED").reduce((s, e) => s + e.amount, 0),
      field: all.filter((e) => (e.costSource || "FIELD") === "FIELD" && e.status === "APPROVED").reduce((s, e) => s + e.amount, 0),
      serviceCenter: all.filter((e) => e.costSource === "SERVICE_CENTER" && e.status === "APPROVED").reduce((s, e) => s + e.amount, 0),
    };
    return NextResponse.json({ report, items, total, page, limit, totalPages: Math.ceil(total / limit), summary });
  }

  return NextResponse.json({ error: "Invalid report" }, { status: 400 });
}
