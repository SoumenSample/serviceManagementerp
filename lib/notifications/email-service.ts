import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<{ success: boolean; error?: string }> {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@espsoln.local";
  const transport = getTransport();
  if (!transport) {
    // Dev mode: log without sensitive data (never log OTP here; caller handles)
    console.log(`[Email DEV] To: ${opts.to} Subject: ${opts.subject} — Email queued (no SMTP)`);
    return { success: true };
  }
  try {
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Email FAILED] To: ${opts.to} Subject: ${opts.subject} Error: ${msg}`);
    return { success: false, error: msg };
  }
}

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
