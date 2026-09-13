import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { Customer } from "@/models/Customer";
import { Otp } from "@/models/Otp";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only super_admin/manager/coordinator can request closure — engineer cannot
  if (!hasPermission(auth.role, "serviceCall.close")) return NextResponse.json({ error: "Forbidden: only manager/coordinator/super_admin can request closure OTP" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const sc = await ServiceCall.findById(id);
  if (!sc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["WORK_COMPLETED", "CUSTOMER_CONFIRMATION"].includes(sc.currentStatus)) return NextResponse.json({ error: `Cannot request OTP in status ${sc.currentStatus}. Must be WORK_COMPLETED or CUSTOMER_CONFIRMATION` }, { status: 400 });

  // Rate limit: max 3 OTPs per 10 minutes
  const recent = await Otp.countDocuments({ serviceCall: id, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } });
  if (recent >= 3) return NextResponse.json({ error: "Rate limit: try again after 10 minutes" }, { status: 429 });

  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await Otp.create({ serviceCall: id, codeHash, expiresAt, createdBy: auth.sub });

  // Derive customer email server-side, send via notification service (hashed OTP only stored, raw never logged in production)
  const customer = await Customer.findById(sc.customer);
  const site = await (await import("@/models/Site")).Site.findById(sc.site);
  const equipment = sc.equipment ? await (await import("@/models/Equipment")).Equipment.findById(sc.equipment) : null;
  const engineer = sc.assignedEngineer ? await (await import("@/models/User")).User.findById(sc.assignedEngineer) : null;
  const email = customer?.email;
  let emailStatus: string = "PENDING";
  if (email) {
    try {
      const { notify } = await import("@/lib/notifications/notification-service");
      const { closureOtpTemplate } = await import("@/lib/notifications/templates");
      const { getCompanySettings } = await import("@/lib/company-settings");
      const companySettings = await getCompanySettings();
      const tpl = closureOtpTemplate(
        {
          customerName: customer.companyName,
          callId: sc.callId,
          siteName: site?.siteName || "",
          equipmentId: equipment?.equipmentId || "",
          jobCategory: sc.complaintType,
          technicianName: engineer?.name || "",
          completionDate: new Date().toLocaleDateString(),
          otp: code,
        },
        companySettings
      );
      const res = await notify({
        eventType: "CUSTOMER_CONFIRMATION_REQUESTED",
        channel: "EMAIL",
        title: tpl.subject,
        message: tpl.html,
        recipientCustomerEmail: email,
        relatedModule: "ServiceCall",
        relatedRecordId: String(sc._id),
        serviceCall: String(sc._id),
        dedupKey: `OTP:${sc._id}:${codeHash.slice(0, 10)}`,
        email: { to: email, subject: tpl.subject, html: tpl.html },
      });
      // notify handles sendEmail and stores Notification with SENT/FAILED; do not log raw OTP
      emailStatus = (res as unknown as { status: string })?.status || "SENT";
    } catch (e) {
      console.error(`[OTP] Failed to send OTP email for ${sc.callId}`);
      emailStatus = "FAILED";
    }
  }
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "OTP_REQUEST",
    module: "SERVICE_CALL",
    recordId: sc.callId,
    recordObjectId: String(sc._id),
    recordType: "ServiceCall",
    description: `OTP requested for service call ${sc.callId}`,
    after: { emailStatus, expiresAt } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(_req) as unknown as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json({ ok: true, expiresAt, emailStatus });
}
