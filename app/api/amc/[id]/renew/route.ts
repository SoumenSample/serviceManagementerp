import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { AmcContract } from "@/models/AmcContract";
import { amcRenewSchema } from "@/lib/validators";
import { genAmcId } from "@/lib/id-generators";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.create") && !hasPermission(auth.role, "amc.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = amcRenewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const old = await AmcContract.findById(id);
  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (old.status === "CANCELLED") return NextResponse.json({ error: "Cannot renew cancelled AMC" }, { status: 400 });

  const newAmcId = await genAmcId();
  const newDoc = await AmcContract.create({
    amcId: newAmcId,
    customer: old.customer,
    site: old.site,
    equipmentIds: old.equipmentIds,
    amcType: parsed.data.newAmcType || old.amcType,
    startDate: new Date(parsed.data.newStartDate),
    endDate: new Date(parsed.data.newEndDate),
    contractAmount: parsed.data.contractAmount ?? old.contractAmount,
    paymentStatus: parsed.data.paymentStatus || "NOT_BILLED",
    assignedEngineer: parsed.data.assignedEngineer || old.assignedEngineer,
    terms: parsed.data.terms || old.terms,
    status: "ACTIVE",
    documents: [],
    renewalHistory: [],
    createdBy: auth.sub,
    updatedBy: auth.sub,
  });

  // Update old AMC to RENEWED and push history
  old.status = "RENEWED";
  old.renewalHistory.push({
    previousAmcId: old.amcId,
    newAmcId: newDoc.amcId,
    renewalDate: new Date(),
    renewedBy: auth.sub as never,
    previousEndDate: old.endDate,
    newStartDate: newDoc.startDate,
    newEndDate: newDoc.endDate,
    remarks: parsed.data.remarks,
  });
  await old.save();

  // Also push reciprocal history to new doc for traceability
  newDoc.renewalHistory.push({
    previousAmcId: old.amcId,
    newAmcId: newDoc.amcId,
    renewalDate: new Date(),
    renewedBy: auth.sub as never,
    previousEndDate: old.endDate,
    newStartDate: newDoc.startDate,
    newEndDate: newDoc.endDate,
    remarks: parsed.data.remarks,
  });
  await newDoc.save();

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "RENEW",
    module: "AMC",
    recordId: newAmcId,
    recordObjectId: String(newDoc._id),
    recordType: "AmcContract",
    description: `AMC ${old.amcId} renewed to ${newAmcId}`,
    before: { amcId: old.amcId, endDate: old.endDate } as unknown as Record<string, unknown>,
    after: { newAmcId, newStartDate: newDoc.startDate, newEndDate: newDoc.endDate } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  // Notifications: AMC renewed — email to customer + in-app to staff
  try {
    const { notify } = await import("@/lib/notifications/notification-service");
    const { amcRenewedTemplate } = await import("@/lib/notifications/templates");
    const { getCompanySettings } = await import("@/lib/company-settings");
    const { Customer } = await import("@/models/Customer");
    const { Site } = await import("@/models/Site");
    const companySettings = await getCompanySettings();
    const customer = await Customer.findById(old.customer);
    const site = await Site.findById(old.site);
    const amountStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(newDoc.contractAmount);
    const tpl = amcRenewedTemplate(
      {
        customerName: customer?.companyName || "Customer",
        oldAmcId: old.amcId,
        newAmcId: newDoc.amcId,
        siteName: site?.siteName || "",
        equipmentCount: (newDoc.equipmentIds as unknown as string[]).length,
        newStartDate: new Date(newDoc.startDate).toLocaleDateString(),
        newEndDate: new Date(newDoc.endDate).toLocaleDateString(),
        contractAmount: amountStr,
        remarks: parsed.data.remarks,
      },
      companySettings
    );
    const { User: UserModel } = await import("@/models/User");
    const staff = await UserModel.find({ role: { $in: ["super_admin", "manager", "coordinator", "accounts"] }, isActive: true }).select("_id").lean();
    for (const u of staff) {
      notify({
        eventType: "AMC_RENEWED",
        channel: "IN_APP",
        title: `AMC Renewed ${old.amcId} → ${newDoc.amcId}`,
        message: `${old.amcId} renewed to ${newDoc.amcId} • ${customer?.companyName || ""} • ${site?.siteName || ""} • ${amountStr}`,
        recipientUser: String(u._id),
        relatedModule: "AmcContract",
        relatedRecordId: String(newDoc._id),
        amc: String(newDoc._id),
        dedupKey: `AMC_RENEWED:${newDoc._id}:IN_APP:${u._id}`,
      }).catch(() => {});
    }
    if (customer?.email) {
      notify({
        eventType: "AMC_RENEWED",
        channel: "EMAIL",
        title: tpl.subject,
        message: tpl.html,
        recipientCustomerEmail: customer.email,
        relatedModule: "AmcContract",
        relatedRecordId: String(newDoc._id),
        amc: String(newDoc._id),
        dedupKey: `AMC_RENEWED:${newDoc._id}:EMAIL:${customer.email}`,
        email: { to: customer.email, subject: tpl.subject, html: tpl.html },
      }).catch(() => {});
    }
  } catch {}

  return NextResponse.json({ oldAmc: old, newAmc: newDoc }, { status: 201 });
}
