import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ASSIGN",
  "UNASSIGN",
  "STATUS_CHANGE",
  "APPROVE",
  "REJECT",
  "SUBMIT",
  "CANCEL",
  "REOPEN",
  "TRANSFER",
  "RENEW",
  "PAYMENT",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "OTP_REQUEST",
  "OTP_VERIFY_SUCCESS",
  "OTP_VERIFY_FAILURE",
  "CLOSE",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_MODULES = [
  "AUTH",
  "USER",
  "CUSTOMER",
  "SITE",
  "EQUIPMENT",
  "AMC",
  "SERVICE_CALL",
  "SERVICE_VISIT",
  "PART",
  "INVENTORY",
  "PART_REQUEST",
  "EXPENSE",
  "INVOICE",
  "PAYMENT",
  "SETTINGS",
  "REPORT",
  "NOTIFICATION",
] as const;
export type AuditModule = (typeof AUDIT_MODULES)[number];

export interface IAuditLog extends Document {
  auditId: string; // AUD-000001
  actor?: Types.ObjectId; // User who performed action, null for anonymous/login failure
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  action: AuditAction;
  module: AuditModule;
  recordId?: string; // human-readable business ID preferred
  recordObjectId?: Types.ObjectId;
  recordType?: string;
  description: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorEmail: String,
    actorName: String,
    actorRole: String,
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    module: { type: String, enum: AUDIT_MODULES, required: true, index: true },
    recordId: { type: String, index: true },
    recordObjectId: { type: Schema.Types.ObjectId },
    recordType: String,
    description: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes for actual query patterns
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ module: 1, createdAt: -1 });
AuditLogSchema.index({ recordId: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ module: 1, action: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
