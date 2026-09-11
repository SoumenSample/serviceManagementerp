import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { OPEN_STATUSES } from "@/lib/servicecall-helpers";
import { Customer } from "@/models/Customer";
import { Site } from "@/models/Site";
import { Equipment } from "@/models/Equipment";
import { User } from "@/models/User";
import { serviceCallSchema } from "@/lib/validators";
import { genCallId } from "@/lib/id-generators";
import { getNextAction } from "@/lib/servicecall-helpers";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const customer = searchParams.get("customer");
  const site = searchParams.get("site");
  const equipment = searchParams.get("equipment");
  const engineer = searchParams.get("engineer");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const overdue = searchParams.get("overdue");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;

  await connectDB();
  const filter: Record<string, unknown> = {};
  if (customer) filter.customer = customer;
  if (site) filter.site = site;
  if (equipment) filter.equipment = equipment;
  if (engineer) filter.assignedEngineer = engineer;
  if (status) filter.currentStatus = status;
  if (priority) filter.priority = priority;
  if (q) {
    const orQ: Record<string, unknown>[] = [{ callId: { $regex: q, $options: "i" } }, { problemDescription: { $regex: q, $options: "i" } }];
    // Search customer/site/equipment by name/id if match
    const custs = await Customer.find({ companyName: { $regex: q, $options: "i" } }).select("_id").lean();
    const sites = await Site.find({ siteName: { $regex: q, $options: "i" } }).select("_id").lean();
    const eqs = await Equipment.find({ $or: [{ equipmentId: { $regex: q, $options: "i" } }, { serialNumber: { $regex: q, $options: "i" } }] }).select("_id").lean();
    if (custs.length) orQ.push({ customer: { $in: custs.map(c => c._id) } });
    if (sites.length) orQ.push({ site: { $in: sites.map(s => s._id) } });
    if (eqs.length) orQ.push({ equipment: { $in: eqs.map(e => e._id) } });
    filter.$or = orQ;
  }
  if (overdue === "true") {
    filter.currentStatus = { $in: OPEN_STATUSES };
    filter.targetVisitDate = { $lt: new Date() };
  }

  const [items, total] = await Promise.all([
    ServiceCall.find(filter)
      .populate("customer", "companyName customerId")
      .populate("site", "siteName siteId")
      .populate("equipment", "equipmentId assetId make model")
      .populate("assignedEngineer", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ServiceCall.countDocuments(filter),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = serviceCallSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();

  const customer = await Customer.findById(parsed.data.customer);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  const site = await Site.findById(parsed.data.site);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 400 });
  if (String(site.customer) !== String(parsed.data.customer)) return NextResponse.json({ error: "Site does not belong to Customer" }, { status: 400 });
  if (parsed.data.equipment) {
    const eq = await Equipment.findById(parsed.data.equipment);
    if (!eq) return NextResponse.json({ error: "Equipment not found" }, { status: 400 });
    if (String(eq.site) !== String(parsed.data.site)) return NextResponse.json({ error: "Equipment does not belong to Site" }, { status: 400 });
  }
  if (parsed.data.assignedEngineer) {
    const eng = await User.findById(parsed.data.assignedEngineer);
    if (!eng || eng.role !== "engineer" || !eng.isActive) return NextResponse.json({ error: "Invalid engineer" }, { status: 400 });
  }

  const callId = await genCallId();
  const initialStatus = parsed.data.assignedEngineer ? "ASSIGNED" : "NEW";
  const nextAction = getNextAction(initialStatus as never);

  const doc = await ServiceCall.create({
    callId,
    customer: parsed.data.customer,
    site: parsed.data.site,
    equipment: parsed.data.equipment || undefined,
    complaintDate: new Date(parsed.data.complaintDate),
    complaintTime: parsed.data.complaintTime,
    complaintType: parsed.data.complaintType,
    problemDescription: parsed.data.problemDescription,
    priority: parsed.data.priority,
    assignedEngineer: parsed.data.assignedEngineer || undefined,
    targetVisitDate: parsed.data.targetVisitDate ? new Date(parsed.data.targetVisitDate) : undefined,
    targetResolutionDate: parsed.data.targetResolutionDate ? new Date(parsed.data.targetResolutionDate) : undefined,
    currentStatus: initialStatus,
    statusHistory: [{ status: initialStatus, date: new Date(), updatedBy: auth.sub, remarks: "Created" }],
    nextAction,
    createdBy: auth.sub,
  });

  // Audit: service call creation
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "SERVICE_CALL",
    recordId: callId,
    recordObjectId: String(doc._id),
    recordType: "ServiceCall",
    description: `Service call ${callId} created for ${customer.companyName}`,
    after: { callId, customer: String(parsed.data.customer), site: String(parsed.data.site), equipment: parsed.data.equipment || null, priority: parsed.data.priority, assignedEngineer: parsed.data.assignedEngineer || null, status: initialStatus } as unknown as Record<string, unknown>,
    metadata: { ...extractRequestMeta(req), customerName: customer.companyName } as Record<string, unknown>,
  }).catch(() => {});
  if (parsed.data.assignedEngineer) {
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "ASSIGN",
      module: "SERVICE_CALL",
      recordId: callId,
      recordObjectId: String(doc._id),
      recordType: "ServiceCall",
      description: `Service call ${callId} assigned to engineer`,
      after: { assignedEngineer: parsed.data.assignedEngineer } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
  }

  // Notifications: customer email + in-app for coordinator/manager/super_admin (fire-and-forget, never delete ServiceCall on failure)
  try {
    const { notify } = await import("@/lib/notifications/notification-service");
    const { newServiceCallCustomerTemplate } = await import("@/lib/notifications/templates");
    const { getCompanySettings } = await import("@/lib/company-settings");
    const companySettings = await getCompanySettings();
    const eq = parsed.data.equipment ? await Equipment.findById(parsed.data.equipment) : null;
    const eng = parsed.data.assignedEngineer ? await User.findById(parsed.data.assignedEngineer) : null;
    if (customer.email) {
      const tpl = newServiceCallCustomerTemplate(
        {
          customerName: customer.companyName,
          callId,
          callDate: new Date(parsed.data.complaintDate).toLocaleDateString(),
          callTime: parsed.data.complaintTime || "",
          jobCategory: parsed.data.complaintType,
          jobStatus: initialStatus,
          technicianName: eng?.name || "To be assigned",
        },
        companySettings
      );
      notify({
        eventType: "NEW_SERVICE_CALL",
        channel: "EMAIL",
        title: tpl.subject,
        message: tpl.html,
        recipientCustomerEmail: customer.email,
        relatedModule: "ServiceCall",
        relatedRecordId: String(doc._id),
        serviceCall: String(doc._id),
        equipment: eq?._id ? String(eq._id) : undefined,
        dedupKey: `NEW_SERVICE_CALL:${doc._id}:EMAIL:${customer.email}`,
        email: { to: customer.email, subject: tpl.subject, html: tpl.html },
      }).catch(() => {});
    }
    // In-app for coordinator/manager/super_admin
    const { User: UserModel } = await import("@/models/User");
    const staff = await UserModel.find({ role: { $in: ["coordinator", "manager", "super_admin"] }, isActive: true }).select("_id").lean();
    for (const u of staff) {
      notify({
        eventType: "NEW_SERVICE_CALL",
        channel: "IN_APP",
        title: "New Service Call",
        message: `${callId} registered for ${customer.companyName}`,
        recipientUser: String(u._id),
        relatedModule: "ServiceCall",
        relatedRecordId: String(doc._id),
        serviceCall: String(doc._id),
        dedupKey: `NEW_SERVICE_CALL:${doc._id}:IN_APP:${u._id}`,
      }).catch(() => {});
    }
  } catch {}

  return NextResponse.json(doc, { status: 201 });
}
