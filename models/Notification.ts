import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const NOTIFICATION_EVENTS = [
  "NEW_SERVICE_CALL",
  "ENGINEER_ASSIGNED",
  "PARTS_REQUIRED",
  "PARTS_RECEIVED",
  "CALL_PENDING",
  "WORK_COMPLETED",
  "CUSTOMER_CONFIRMATION_REQUESTED",
  "CALL_CLOSED",
  "AMC_EXPIRING",
  "AMC_EXPIRED",
] as const;

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"] as const;
export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED", "READ"] as const;

export interface INotification extends Document {
  notificationId: string;
  recipientUser?: Types.ObjectId;
  recipientCustomerEmail?: string;
  eventType: string;
  channel: string;
  title: string;
  message: string;
  relatedModule?: string;
  relatedRecordId?: string;
  serviceCall?: Types.ObjectId;
  equipment?: Types.ObjectId;
  amc?: Types.ObjectId;
  status: string;
  isRead: boolean;
  readAt?: Date;
  dedupKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    recipientUser: { type: Schema.Types.ObjectId, ref: "User", index: true },
    recipientCustomerEmail: { type: String, lowercase: true },
    eventType: { type: String, required: true, index: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedModule: String,
    relatedRecordId: String,
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall" },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment" },
    amc: { type: Schema.Types.ObjectId, ref: "AmcContract" },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "PENDING", index: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
    dedupKey: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientUser: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ dedupKey: 1 }, { unique: true, sparse: true });

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
