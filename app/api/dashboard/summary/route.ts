import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { User } from "@/models/User";
import { Customer } from "@/models/Customer";
import { Site } from "@/models/Site";
import { Equipment } from "@/models/Equipment";
import { AmcContract } from "@/models/AmcContract";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";
import { PartRequest } from "@/models/PartRequest";
import { Inventory } from "@/models/Inventory";
import "@/models/Part";
import { Invoice } from "@/models/Invoice";
import { ServiceExpense } from "@/models/ServiceExpense";
import { getComputedAmcStatus } from "@/lib/amc-helpers";
import { OPEN_STATUSES } from "@/lib/servicecall-helpers";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const user = await User.findById(auth.sub);
  if (!user || !user.isActive) return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  const role = auth.role;

  // AMC stats (all roles can see AMC overview)
  const amcs = await AmcContract.find({ status: { $nin: ["CANCELLED", "RENEWED"] } }).select("startDate endDate status").lean();
  let amcActiveExclusive = 0, amc15 = 0, amc30 = 0, amcExpired = 0;
  for (const a of amcs as unknown as { startDate: string; endDate: string; status: string }[]) {
    const c = getComputedAmcStatus(a.startDate, a.endDate, a.status as never);
    if (c === "ACTIVE") amcActiveExclusive++;
    else if (c === "EXPIRING_15") amc15++;
    else if (c === "EXPIRING_30") amc30++;
    else if (c === "EXPIRED") amcExpired++;
  }
  // Active = total currently valid (ACTIVE + expiring soon) — user expectation is that expiring contracts are still active
  const amcActive = amcActiveExclusive + amc15 + amc30;

  // Inventory alerts (all)
  const invs = await Inventory.find().populate("part", "minimumStockLevel").lean();
  let lowStock = 0, outStock = 0;
  for (const inv of invs as unknown as { part: { minimumStockLevel: number } | null; quantityOnHand: number; quantityReserved: number }[]) {
    if (!inv.part) continue;
    const avail = inv.quantityOnHand - inv.quantityReserved;
    if (avail <= 0) outStock++;
    else if (avail <= inv.part.minimumStockLevel) lowStock++;
  }
  const pendingPartRequests = await PartRequest.countDocuments({ status: { $in: ["REQUIRED", "REQUESTED", "APPROVED", "DISPATCHED"] } });

  // Finance summary (for accounts/manager/super_admin)
  const invoices = await Invoice.find({ paymentStatus: { $ne: "CANCELLED" } }).lean();
  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const outstanding = totalInvoiced - totalPaid;
  const overdueInvoices = invoices.filter((i) => i.dueDate && new Date(i.dueDate) < new Date() && i.totalAmount - i.paidAmount > 0).length;
  const pendingExpenses = await ServiceExpense.countDocuments({ status: "SUBMITTED" });
  const approvedExpenses = await ServiceExpense.countDocuments({ status: "APPROVED" });

  // ServiceCall stats - role scoped
  let serviceFilter: Record<string, unknown> = {};
  if (role === "engineer") serviceFilter.assignedEngineer = auth.sub;

  const [totalCustomers, totalSites, totalEquipment, totalEngineers] = await Promise.all([
    Customer.countDocuments(),
    Site.countDocuments(),
    Equipment.countDocuments(),
    User.countDocuments({ role: "engineer", isActive: true }),
  ]);

  const openCalls = await ServiceCall.countDocuments({ ...serviceFilter, currentStatus: { $in: OPEN_STATUSES } });
  const pendingCalls = await ServiceCall.countDocuments({ ...serviceFilter, currentStatus: { $in: ["NEW", "ASSIGNED", "VISIT_SCHEDULED", "PARTS_REQUIRED", "ON_HOLD"] } });
  const closedCalls = await ServiceCall.countDocuments({ ...serviceFilter, currentStatus: "CLOSED" });
  const overdueCalls = await ServiceCall.countDocuments({ ...serviceFilter, currentStatus: { $in: OPEN_STATUSES }, targetVisitDate: { $lt: new Date() } });
  const workCompleted = await ServiceCall.countDocuments({ ...serviceFilter, currentStatus: { $in: ["WORK_COMPLETED", "CUSTOMER_CONFIRMATION", "CLOSED"] } });
  const unassignedCalls = await ServiceCall.countDocuments({ assignedEngineer: { $exists: false } });
  const engineersWithOpen = await ServiceCall.distinct("assignedEngineer", { currentStatus: { $in: OPEN_STATUSES }, assignedEngineer: { $ne: null } });

  // pending calls list (limit 5)
  const pendingList = await ServiceCall.find({ ...serviceFilter, currentStatus: { $in: OPEN_STATUSES } })
    .populate("site", "siteName")
    .populate("equipment", "equipmentId")
    .populate("assignedEngineer", "name")
    .sort({ priority: -1, createdAt: -1 })
    .limit(5)
    .lean();

  // SLA averages
  const closedWithDates = await ServiceCall.find({ ...serviceFilter, actualVisitDate: { $exists: true }, complaintDate: { $exists: true } }).select("complaintDate actualVisitDate actualResolutionDate").limit(100).lean();
  let avgResponse: number | null = null, avgResolution: number | null = null;
  if (closedWithDates.length) {
    const responses = closedWithDates.filter((c) => c.actualVisitDate).map((c) => (new Date(c.actualVisitDate as Date).getTime() - new Date(c.complaintDate).getTime()) / (1000 * 60 * 60 * 24));
    const resolutions = closedWithDates.filter((c) => c.actualResolutionDate).map((c) => (new Date(c.actualResolutionDate as Date).getTime() - new Date(c.complaintDate).getTime()) / (1000 * 60 * 60 * 24));
    if (responses.length) avgResponse = responses.reduce((a, b) => a + b, 0) / responses.length;
    if (resolutions.length) avgResolution = resolutions.reduce((a, b) => a + b, 0) / resolutions.length;
  }

  // Engineer specific today visits
  let engineerTodayVisits = 0;
  if (role === "engineer") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    engineerTodayVisits = await ServiceVisit.countDocuments({ engineer: auth.sub, visitDate: { $gte: today, $lt: tomorrow } });
  }
  const visitsToday = await ServiceVisit.countDocuments({ visitDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(24, 0, 0, 0)) } });

  // AMC payment breakdown for accounts
  const amcNotBilled = await AmcContract.countDocuments({ paymentStatus: "NOT_BILLED" });
  const amcInvoiced = await AmcContract.countDocuments({ paymentStatus: "INVOICED" });
  const amcPartial = await AmcContract.countDocuments({ paymentStatus: "PARTIAL" });
  const amcPaid = await AmcContract.countDocuments({ paymentStatus: "PAID" });
  const amcOverdue = await AmcContract.countDocuments({ paymentStatus: "OVERDUE" });

  return NextResponse.json({
    role,
    master: { totalCustomers, totalSites, totalEquipment, totalEngineers },
    amc: { active: amcActive, expiring15: amc15, expiring30: amc30, expired: amcExpired, notBilled: amcNotBilled, invoiced: amcInvoiced, partial: amcPartial, paid: amcPaid, overdue: amcOverdue },
    service: { open: openCalls, pending: pendingCalls, closed: closedCalls, overdue: overdueCalls, workCompleted, unassigned: unassignedCalls, engineersWithOpen: engineersWithOpen.length, visitsToday, avgResponse, avgResolution, pendingList },
    inventory: { pendingPartRequests, lowStock, outOfStock: outStock },
    finance: { totalInvoiced, totalPaid, outstanding, overdueInvoices, pendingExpenses, approvedExpenses },
    engineer: { todayVisits: engineerTodayVisits },
  });
}
