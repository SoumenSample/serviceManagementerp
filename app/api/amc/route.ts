import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { AmcContract } from "@/models/AmcContract";
import { Customer } from "@/models/Customer";
import { Site } from "@/models/Site";
import { Equipment } from "@/models/Equipment";
import { User } from "@/models/User";
import { amcSchema } from "@/lib/validators";
import { genAmcId } from "@/lib/id-generators";
import { getComputedAmcStatus, getDaysRemaining } from "@/lib/amc-helpers";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const customer = searchParams.get("customer");
  const site = searchParams.get("site");
  const engineer = searchParams.get("engineer");
  const amcType = searchParams.get("amcType");
  const paymentStatus = searchParams.get("paymentStatus");
  const status = searchParams.get("status"); // stored status
  const expiry = searchParams.get("expiry"); // 30,15,expired,active
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (customer) filter.customer = customer;
  if (site) filter.site = site;
  if (engineer) filter.assignedEngineer = engineer;
  if (amcType) filter.amcType = amcType;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (status && status !== "EXPIRING_30" && status !== "EXPIRING_15" && status !== "EXPIRED") filter.status = status;

  // Text search across AMC ID, customer, site, equipment — need equipment lookup for equipment ID search
  let equipmentIdsForSearch: string[] | null = null;
  if (q) {
    // search AMC ID directly
    const directFilter: Record<string, unknown> = { ...filter };
    // We'll fetch candidates and filter further in memory for equipment search complexity
    // Do equipment search
    const eqs = await Equipment.find({
      $or: [
        { equipmentId: { $regex: q, $options: "i" } },
        { assetId: { $regex: q, $options: "i" } },
        { serialNumber: { $regex: q, $options: "i" } },
      ],
    }).select("_id").lean();
    equipmentIdsForSearch = eqs.map((e) => String(e._id));
    // Also customer/site name search
    const custs = await Customer.find({ companyName: { $regex: q, $options: "i" } }).select("_id").lean();
    const sites = await Site.find({ siteName: { $regex: q, $options: "i" } }).select("_id").lean();
    const custIds = custs.map((c) => String(c._id));
    const siteIds = sites.map((s) => String(s._id));
    const orConditions: Record<string, unknown>[] = [{ amcId: { $regex: q, $options: "i" } }];
    if (custIds.length) orConditions.push({ customer: { $in: custIds } });
    if (siteIds.length) orConditions.push({ site: { $in: siteIds } });
    if (equipmentIdsForSearch.length) orConditions.push({ equipmentIds: { $in: equipmentIdsForSearch } });
    filter.$or = orConditions;
  }

  // Fetch all matching then apply expiry computed filter in memory for accuracy (date source of truth)
  // But paginate efficiently: we need to fetch filtered set without expiry then compute
  // For simplicity with moderate data, fetch with pagination and post-filter expiry if requested via computed status
  // Expiry filter: active, expiring15 (0-15), expiring30 (16-30), expired (<0)
  const baseQuery = AmcContract.find(filter)
    .populate("customer", "companyName customerId")
    .populate("site", "siteName siteId")
    .populate("assignedEngineer", "name email")
    .populate("equipmentIds", "equipmentId assetId make model serialNumber")
    .sort({ createdAt: -1 })
    .lean();

  let items: unknown[];
  let total: number;
  if (expiry || status === "EXPIRING_15" || status === "EXPIRING_30" || status === "EXPIRED") {
    const target = expiry || status;
    const all = await baseQuery;
    const filtered = (all as unknown as { endDate: string; status: string; startDate: string }[]).filter((doc: unknown) => {
      const d = doc as { endDate: string; status: string; startDate: string };
      const computed = getComputedAmcStatus(d.startDate, d.endDate, d.status as never);
      if (target === "EXPIRING_15") return computed === "EXPIRING_15";
      if (target === "EXPIRING_30") return computed === "EXPIRING_30"; // mutually exclusive 16-30
      if (target === "EXPIRED" || target === "EXPIRED_COMPUTED") return computed === "EXPIRED";
      if (target === "active") return computed === "ACTIVE";
      return true;
    });
    total = filtered.length;
    items = filtered.slice(skip, skip + limit);
  } else {
    [items, total] = await Promise.all([
      AmcContract.find(filter).populate("customer", "companyName customerId").populate("site", "siteName siteId").populate("assignedEngineer", "name email").populate("equipmentIds", "equipmentId assetId make model serialNumber").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AmcContract.countDocuments(filter),
    ]);
  }

  // Attach computed fields
  const enriched = (items as unknown as { endDate: string; startDate: string; status: string }[]).map((doc) => {
    const d = doc as unknown as { endDate: string; startDate: string; status: string };
    const daysRemaining = getDaysRemaining(d.endDate);
    const computedStatus = getComputedAmcStatus(d.startDate, d.endDate, d.status as never);
    return { ...doc, daysRemaining, computedStatus };
  });

  return NextResponse.json({ items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = amcSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();

  // Validations 1-10
  const customer = await Customer.findById(parsed.data.customer);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  const site = await Site.findById(parsed.data.site);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 400 });
  if (String(site.customer) !== String(parsed.data.customer)) return NextResponse.json({ error: "Site does not belong to Customer" }, { status: 400 });

  const eqs = await Equipment.find({ _id: { $in: parsed.data.equipmentIds } });
  if (eqs.length !== parsed.data.equipmentIds.length) return NextResponse.json({ error: "Some equipment not found" }, { status: 400 });
  for (const eq of eqs) {
    if (String(eq.site) !== String(parsed.data.site)) return NextResponse.json({ error: `Equipment ${eq.equipmentId} does not belong to selected Site` }, { status: 400 });
  }

  if (parsed.data.assignedEngineer) {
    const eng = await User.findById(parsed.data.assignedEngineer);
    if (!eng || eng.role !== "engineer" || !eng.isActive) return NextResponse.json({ error: "Assigned engineer must be active Engineer" }, { status: 400 });
  }

  const amcId = await genAmcId();
  let paidAmount = Number(parsed.data.paidAmount ?? 0);
  if (parsed.data.paymentStatus === "PAID") paidAmount = parsed.data.contractAmount;
  if (paidAmount > parsed.data.contractAmount) return NextResponse.json({ error: "Paid amount cannot exceed contract amount" }, { status: 400 });
  if (parsed.data.paymentStatus === "PARTIAL" && (!paidAmount || paidAmount <= 0 || paidAmount >= parsed.data.contractAmount)) return NextResponse.json({ error: "For PARTIAL, paid amount must be >0 and < contract amount" }, { status: 400 });
  const doc = await AmcContract.create({
    amcId,
    customer: parsed.data.customer,
    site: parsed.data.site,
    equipmentIds: parsed.data.equipmentIds,
    amcType: parsed.data.amcType,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    contractAmount: parsed.data.contractAmount,
    paymentStatus: parsed.data.paymentStatus,
    paidAmount,
    assignedEngineer: parsed.data.assignedEngineer || undefined,
    terms: parsed.data.terms,
    status: parsed.data.status,
    createdBy: auth.sub,
    updatedBy: auth.sub,
  });

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "AMC",
    recordId: amcId,
    recordObjectId: String(doc._id),
    recordType: "AmcContract",
    description: `AMC ${amcId} created for ${customer.companyName}`,
    after: { amcId, amcType: parsed.data.amcType, customer: parsed.data.customer } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  // Notifications: AMC created — email to customer + in-app to staff
  try {
    const { notify } = await import("@/lib/notifications/notification-service");
    const { amcCreatedTemplate } = await import("@/lib/notifications/templates");
    const { getCompanySettings } = await import("@/lib/company-settings");
    const companySettings = await getCompanySettings();
    const amountStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(parsed.data.contractAmount);
    const paidStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paidAmount);
    const remainingStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.max(0, parsed.data.contractAmount - paidAmount));
    const tpl = amcCreatedTemplate(
      {
        customerName: customer.companyName,
        amcId,
        amcType: parsed.data.amcType,
        siteName: site.siteName,
        equipmentCount: parsed.data.equipmentIds.length,
        startDate: new Date(parsed.data.startDate).toLocaleDateString(),
        endDate: new Date(parsed.data.endDate).toLocaleDateString(),
        contractAmount: amountStr,
        paymentStatus: parsed.data.paymentStatus,
        paidAmount: paidStr,
        remainingAmount: remainingStr,
      },
      companySettings
    );
    // In-app to super_admin/manager/coordinator/accounts
    const { User: UserModel } = await import("@/models/User");
    const staff = await UserModel.find({ role: { $in: ["super_admin", "manager", "coordinator", "accounts"] }, isActive: true }).select("_id").lean();
    for (const u of staff) {
      notify({
        eventType: "AMC_CREATED",
        channel: "IN_APP",
        title: `New AMC ${amcId}`,
        message: `${amcId} • ${customer.companyName} • ${site.siteName} • ${parsed.data.amcType} • ${amountStr} • ${parsed.data.paymentStatus}${parsed.data.paymentStatus === "PARTIAL" ? ` • Paid ${paidStr} • Due ${remainingStr}` : ""}`,
        recipientUser: String(u._id),
        relatedModule: "AmcContract",
        relatedRecordId: String(doc._id),
        amc: String(doc._id),
        dedupKey: `AMC_CREATED:${doc._id}:IN_APP:${u._id}`,
      }).catch(() => {});
    }
    // Email to customer if available
    if (customer.email) {
      notify({
        eventType: "AMC_CREATED",
        channel: "EMAIL",
        title: tpl.subject,
        message: tpl.html,
        recipientCustomerEmail: customer.email,
        relatedModule: "AmcContract",
        relatedRecordId: String(doc._id),
        amc: String(doc._id),
        dedupKey: `AMC_CREATED:${doc._id}:EMAIL:${customer.email}`,
        email: { to: customer.email, subject: tpl.subject, html: tpl.html },
      }).catch(() => {});
    }
  } catch {}

  return NextResponse.json(doc, { status: 201 });
}
