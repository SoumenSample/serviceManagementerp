import { escapeHtml } from "./email-service";
import { DEFAULT_COMPANY_SETTINGS, type CompanySettings } from "@/lib/company-settings";

function brandFooter(s: CompanySettings): string {
  return `
<p style="margin-top:24px; font-size:12px; color:#666;">
Regards,<br/>${escapeHtml(s.companyName)}<br/>
Customer Care: ${escapeHtml(s.customerCare1)}, ${escapeHtml(s.customerCare2)}<br/>
Email: <a href="mailto:${escapeHtml(s.companyEmail)}">${escapeHtml(s.companyEmail)}</a>
</p>`;
}

export function newServiceCallCustomerTemplate(
  data: { customerName: string; callId: string; callDate: string; callTime: string; jobCategory: string; jobStatus: string; technicianName: string },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `Service Call Registered – ${escapeHtml(data.callId)}`;
  const footer = brandFooter(company);
  const html = `
<p>Dear ${escapeHtml(data.customerName)},</p>
<p>Your service call has been successfully registered with us and assigned to our expert technician.</p>
<p><strong>Service Call Details</strong></p>
<ul>
<li>Call Date: ${escapeHtml(data.callDate)}</li>
<li>Call Time: ${escapeHtml(data.callTime)}</li>
<li>Call ID: ${escapeHtml(data.callId)}</li>
<li>Job Category: ${escapeHtml(data.jobCategory)}</li>
<li>Job Status: ${escapeHtml(data.jobStatus)}</li>
<li>Technician: ${escapeHtml(data.technicianName)}</li>
</ul>
<p>Our team will update you with the necessary response regarding your service request.</p>
<p>We appreciate your cooperation and request you to save the following mobile numbers as our official service channel for client communication:</p>
<p>Customer Care: ${escapeHtml(company.customerCare1)}, ${escapeHtml(company.customerCare2)}<br/>Email: <a href="mailto:${escapeHtml(company.companyEmail)}">${escapeHtml(company.companyEmail)}</a></p>
${footer}
`;
  return { subject, html, text: `Service Call ${data.callId} registered` };
}

export function workCompletedCustomerTemplate(
  data: { customerName: string; callId: string },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `Service Work Completed – ${escapeHtml(data.callId)}`;
  const footer = brandFooter(company);
  const html = `<p>Dear ${escapeHtml(data.customerName)},</p><p>Your service request ${escapeHtml(data.callId)} has been marked as work completed. Customer confirmation via OTP is next.</p>${footer}`;
  return { subject, html };
}

export function closureOtpTemplate(
  data: { customerName: string; callId: string; siteName: string; equipmentId: string; jobCategory: string; technicianName: string; completionDate: string; otp: string },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `Service Call Closure Verification OTP – ${escapeHtml(data.callId)}`;
  const footer = brandFooter(company);
  const html = `
<p>Dear ${escapeHtml(data.customerName)},</p>
<p>Your service request ${escapeHtml(data.callId)} has been marked as work completed by our service team.</p>
<p>To confirm that the service has been completed and close the service call, please use the following One-Time Password (OTP):</p>
<p style="font-size:20px; font-weight:bold; letter-spacing:4px;">Your OTP: ${escapeHtml(data.otp)}</p>
<p><strong>Service Call Details:</strong></p>
<ul>
<li>Call ID: ${escapeHtml(data.callId)}</li>
<li>Site: ${escapeHtml(data.siteName)}</li>
<li>Equipment ID: ${escapeHtml(data.equipmentId)}</li>
<li>Job Category: ${escapeHtml(data.jobCategory)}</li>
<li>Technician: ${escapeHtml(data.technicianName)}</li>
<li>Completion Date: ${escapeHtml(data.completionDate)}</li>
</ul>
<p>This OTP is valid for 10 minutes and can be used only once.</p>
<p>If you have any concerns regarding the completed service, please contact our customer care team before sharing the OTP.</p>
<p>Customer Care: ${escapeHtml(company.customerCare1)}, ${escapeHtml(company.customerCare2)}<br/>Email: <a href="mailto:${escapeHtml(company.companyEmail)}">${escapeHtml(company.companyEmail)}</a></p>
${footer}
`;
  return { subject, html };
}

export function callClosedCustomerTemplate(
  data: { customerName: string; callId: string; equipmentId: string; siteName: string; completionDate: string; technicianName: string },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `Service Call Closed – ${escapeHtml(data.callId)}`;
  const footer = brandFooter(company);
  const html = `<p>Dear ${escapeHtml(data.customerName)},</p><p>Your service call ${escapeHtml(data.callId)} has been successfully closed after confirmation.</p><ul><li>Equipment: ${escapeHtml(data.equipmentId)}</li><li>Site: ${escapeHtml(data.siteName)}</li><li>Technician: ${escapeHtml(data.technicianName)}</li><li>Completion: ${escapeHtml(data.completionDate)}</li></ul>${footer}`;
  return { subject, html };
}

export function amcExpiringTemplate(
  data: { customerName: string; amcId: string; endDate: string; days: number },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `AMC Expiring Soon – ${escapeHtml(data.amcId)} (${data.days} days)`;
  const footer = brandFooter(company);
  const html = `<p>Dear ${escapeHtml(data.customerName)},</p><p>Your AMC ${escapeHtml(data.amcId)} expires on ${escapeHtml(data.endDate)} (${data.days} days). Please renew.</p>${footer}`;
  return { subject, html };
}

export function amcCreatedTemplate(
  data: { customerName: string; amcId: string; amcType: string; siteName: string; equipmentCount: number; startDate: string; endDate: string; contractAmount: string; paymentStatus: string; paidAmount?: string; remainingAmount?: string },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `AMC Created – ${escapeHtml(data.amcId)} for ${escapeHtml(data.customerName)}`;
  const footer = brandFooter(company);
  const paidLine = data.paymentStatus === "PARTIAL" ? `<li>Paid: ${escapeHtml(data.paidAmount || "")} • Remaining: ${escapeHtml(data.remainingAmount || "")}</li>` : "";
  const html = `
<p>Dear ${escapeHtml(data.customerName)},</p>
<p>Your AMC has been created successfully.</p>
<p><strong>AMC Details</strong></p>
<ul>
<li>AMC ID: ${escapeHtml(data.amcId)}</li>
<li>Type: ${escapeHtml(data.amcType)}</li>
<li>Site: ${escapeHtml(data.siteName)}</li>
<li>Equipment Covered: ${data.equipmentCount}</li>
<li>Period: ${escapeHtml(data.startDate)} to ${escapeHtml(data.endDate)}</li>
<li>Contract Amount: ${escapeHtml(data.contractAmount)}</li>
<li>Payment Status: ${escapeHtml(data.paymentStatus)}</li>
${paidLine}
</ul>
${footer}
`;
  return { subject, html, text: `AMC ${data.amcId} created for ${data.customerName}` };
}

export function amcRenewedTemplate(
  data: { customerName: string; oldAmcId: string; newAmcId: string; siteName: string; equipmentCount: number; newStartDate: string; newEndDate: string; contractAmount: string; remarks?: string },
  company: CompanySettings = DEFAULT_COMPANY_SETTINGS
) {
  const subject = `AMC Renewed – ${escapeHtml(data.oldAmcId)} → ${escapeHtml(data.newAmcId)}`;
  const footer = brandFooter(company);
  const html = `
<p>Dear ${escapeHtml(data.customerName)},</p>
<p>Your AMC has been renewed successfully.</p>
<p><strong>Renewal Details</strong></p>
<ul>
<li>Previous AMC: ${escapeHtml(data.oldAmcId)}</li>
<li>New AMC: ${escapeHtml(data.newAmcId)}</li>
<li>Site: ${escapeHtml(data.siteName)}</li>
<li>Equipment Covered: ${data.equipmentCount}</li>
<li>New Period: ${escapeHtml(data.newStartDate)} to ${escapeHtml(data.newEndDate)}</li>
<li>Contract Amount: ${escapeHtml(data.contractAmount)}</li>
${data.remarks ? `<li>Remarks: ${escapeHtml(data.remarks)}</li>` : ""}
</ul>
${footer}
`;
  return { subject, html, text: `AMC ${data.oldAmcId} renewed to ${data.newAmcId}` };
}
