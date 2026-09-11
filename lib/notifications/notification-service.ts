import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { sendEmail } from "./email-service";

type NotifyOpts = {
  eventType: string;
  channel: "IN_APP" | "EMAIL";
  title: string;
  message: string;
  recipientUser?: string;
  recipientCustomerEmail?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  serviceCall?: string;
  equipment?: string;
  amc?: string;
  dedupKey?: string;
  email?: { to: string; subject: string; html: string; text?: string };
};

async function genId(): Promise<string> {
  const { nextSequence } = await import("@/lib/id-generators");
  const n = await nextSequence("notificationId");
  return `NOTIF-${String(n).padStart(6, "0")}`;
}

export async function notify(opts: NotifyOpts) {
  await connectDB();
  const dedupKey = opts.dedupKey;
  if (dedupKey) {
    const exists = await Notification.findOne({ dedupKey });
    if (exists) return exists; // idempotent
  }
  const notificationId = await genId();
  let status: string = "PENDING";
  let isRead = false;

  if (opts.channel === "EMAIL" && opts.email) {
    const res = await sendEmail(opts.email);
    status = res.success ? "SENT" : "FAILED";
  } else if (opts.channel === "IN_APP") {
    status = "PENDING";
  }

  try {
    const doc = await Notification.create({
      notificationId,
      recipientUser: opts.recipientUser || undefined,
      recipientCustomerEmail: opts.recipientCustomerEmail || opts.email?.to,
      eventType: opts.eventType,
      channel: opts.channel,
      title: opts.title,
      message: opts.message,
      relatedModule: opts.relatedModule,
      relatedRecordId: opts.relatedRecordId,
      serviceCall: opts.serviceCall || undefined,
      equipment: opts.equipment || undefined,
      amc: opts.amc || undefined,
      status,
      isRead,
      dedupKey,
    });
    return doc;
  } catch (e) {
    // Duplicate dedupKey race
    if (dedupKey) {
      const exists = await Notification.findOne({ dedupKey });
      if (exists) return exists;
    }
    throw e;
  }
}

// Provider abstraction for future WhatsApp
export const notificationProviders = {
  inApp: (opts: Omit<NotifyOpts, "channel">) => notify({ ...opts, channel: "IN_APP" }),
  email: (opts: Omit<NotifyOpts, "channel"> & { email: { to: string; subject: string; html: string } }) => notify({ ...opts, channel: "EMAIL" }),
};
