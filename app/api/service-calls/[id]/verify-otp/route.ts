import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { Otp } from "@/models/Otp";
import { isValidTransition, getNextAction } from "@/lib/servicecall-helpers";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "serviceCall.close")) return NextResponse.json({ error: "Forbidden: only manager/coordinator/super_admin can verify OTP and close" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const otp = String(body.otp || "").trim();
  if (!/^\d{6}$/.test(otp)) return NextResponse.json({ error: "Invalid OTP format" }, { status: 400 });
  await connectDB();
  const sc = await ServiceCall.findById(id);
  if (!sc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const record = await Otp.findOne({ serviceCall: id, verified: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!record) return NextResponse.json({ error: "No valid OTP. Request new code." }, { status: 400 });
  if (record.attempts >= 3) return NextResponse.json({ error: "Too many attempts. Request new OTP." }, { status: 400 });

  const ok = await bcrypt.compare(otp, record.codeHash);
  if (!ok) {
    record.attempts += 1;
    await record.save();
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "OTP_VERIFY_FAILURE",
      module: "SERVICE_CALL",
      recordId: sc.callId,
      recordObjectId: String(sc._id),
      recordType: "ServiceCall",
      description: `OTP verification failed for ${sc.callId}`,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    return NextResponse.json({ error: "Incorrect OTP" }, { status: 400 });
  }
  record.verified = true;
  record.attempts += 1;
  await record.save();

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "OTP_VERIFY_SUCCESS",
    module: "SERVICE_CALL",
    recordId: sc.callId,
    recordObjectId: String(sc._id),
    recordType: "ServiceCall",
    description: `OTP verified for ${sc.callId}`,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  // Perform transitions: WORK_COMPLETED -> CUSTOMER_CONFIRMATION -> CLOSED (two steps in one verify for UX)
  // Respect state machine: only valid transitions
  const from = sc.currentStatus;
  if (from === "WORK_COMPLETED" && isValidTransition(from as never, "CUSTOMER_CONFIRMATION" as never)) {
    sc.currentStatus = "CUSTOMER_CONFIRMATION";
    sc.statusHistory.push({ status: "CUSTOMER_CONFIRMATION", date: new Date(), updatedBy: auth.sub as never, remarks: "Customer OTP verified" });
    sc.nextAction = getNextAction("CUSTOMER_CONFIRMATION");
    await sc.save();
  }
  // Now try CLOSED if we are at CUSTOMER_CONFIRMATION (either just transitioned or already there)
  if (sc.currentStatus === "CUSTOMER_CONFIRMATION" && isValidTransition("CUSTOMER_CONFIRMATION" as never, "CLOSED" as never)) {
    sc.currentStatus = "CLOSED";
    sc.actualResolutionDate = new Date();
    sc.statusHistory.push({ status: "CLOSED", date: new Date(), updatedBy: auth.sub as never, remarks: "Closed via OTP" });
    sc.nextAction = getNextAction("CLOSED");
    await sc.save();
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "CLOSE",
      module: "SERVICE_CALL",
      recordId: sc.callId,
      recordObjectId: String(sc._id),
      recordType: "ServiceCall",
      description: `Service call ${sc.callId} closed via OTP verification`,
      before: { status: from } as unknown as Record<string, unknown>,
      after: { status: "CLOSED" } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    // Notify customer and internal that call is closed
    try {
      const { notify } = await import("@/lib/notifications/notification-service");
      const { callClosedCustomerTemplate } = await import("@/lib/notifications/templates");
      const { getCompanySettings } = await import("@/lib/company-settings");
      const companySettings = await getCompanySettings();
      const customer = await (await import("@/models/Customer")).Customer.findById(sc.customer);
      const site = await (await import("@/models/Site")).Site.findById(sc.site);
      const eq = sc.equipment ? await (await import("@/models/Equipment")).Equipment.findById(sc.equipment) : null;
      const eng = sc.assignedEngineer ? await (await import("@/models/User")).User.findById(sc.assignedEngineer) : null;
      if (customer?.email) {
        const tpl = callClosedCustomerTemplate({ customerName: customer.companyName, callId: sc.callId, equipmentId: eq?.equipmentId || "", siteName: site?.siteName || "", completionDate: new Date().toLocaleDateString(), technicianName: eng?.name || "" }, companySettings);
        notify({ eventType: "CALL_CLOSED", channel: "EMAIL", title: tpl.subject, message: tpl.html, recipientCustomerEmail: customer.email, relatedModule: "ServiceCall", relatedRecordId: String(sc._id), serviceCall: String(sc._id), dedupKey: `CALL_CLOSED:${sc._id}:EMAIL:${customer.email}`, email: { to: customer.email, subject: tpl.subject, html: tpl.html } }).catch(() => {});
      }
      const { User } = await import("@/models/User");
      const staff = await User.find({ role: { $in: ["manager", "coordinator", "super_admin"] }, isActive: true }).select("_id").lean();
      for (const u of staff) notify({ eventType: "CALL_CLOSED", channel: "IN_APP", title: "Service Call Closed", message: `${sc.callId} closed after OTP`, recipientUser: String(u._id), relatedModule: "ServiceCall", relatedRecordId: String(sc._id), serviceCall: String(sc._id), dedupKey: `CALL_CLOSED:${sc._id}:IN_APP:${u._id}` }).catch(() => {});
    } catch {}
    return NextResponse.json({ ok: true, status: "CLOSED" });
  }
  if (sc.currentStatus === "CUSTOMER_CONFIRMATION") return NextResponse.json({ ok: true, status: sc.currentStatus });
  return NextResponse.json({ error: `Cannot verify OTP in status ${from}` }, { status: 400 });
}
