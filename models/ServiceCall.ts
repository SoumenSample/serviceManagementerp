import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const SERVICE_STATUSES = [
  "NEW",
  "ASSIGNED",
  "VISIT_SCHEDULED",
  "ENGINEER_VISITED",
  "DIAGNOSIS",
  "REPAIR_IN_PROGRESS",
  "PARTS_REQUIRED",
  "PARTS_RECEIVED",
  "WORK_COMPLETED",
  "CUSTOMER_CONFIRMATION",
  "CLOSED",
  "ON_HOLD",
  "CANCELLED",
  "REOPENED",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const COMPLAINT_TYPES = ["BREAKDOWN", "PREVENTIVE", "INSTALLATION", "OTHER"] as const;

export interface IStatusHistory {
  status: ServiceStatus;
  date: Date;
  updatedBy?: Types.ObjectId;
  remarks?: string;
  attachments?: string[];
}

export interface IAssignmentHistory {
  engineer: Types.ObjectId;
  assignedAt: Date;
  assignedBy?: Types.ObjectId;
  reason?: string;
  visitId?: string;
}

export interface IServiceCall extends Document {
  callId: string; // SC-2026-000001
  customer: Types.ObjectId;
  site: Types.ObjectId;
  equipment?: Types.ObjectId;
  complaintDate: Date;
  complaintTime?: string;
  complaintType: string;
  problemDescription: string;
  priority: Priority;
  assignedEngineer?: Types.ObjectId;
  assignmentHistory: IAssignmentHistory[];
  targetVisitDate?: Date;
  targetResolutionDate?: Date;
  actualVisitDate?: Date;
  actualResolutionDate?: Date;
  currentStatus: ServiceStatus;
  statusHistory: IStatusHistory[];
  nextAction?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StatusHistorySchema = new Schema<IStatusHistory>(
  {
    status: { type: String, enum: SERVICE_STATUSES, required: true },
    date: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    remarks: String,
    attachments: [String],
  },
  { _id: false }
);

const AssignmentHistorySchema = new Schema<IAssignmentHistory>(
  {
    engineer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reason: String,
    visitId: String,
  },
  { _id: false }
);

const ServiceCallSchema = new Schema<IServiceCall>(
  {
    callId: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    site: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment", index: true },
    complaintDate: { type: Date, required: true, index: true },
    complaintTime: String,
    complaintType: { type: String, enum: COMPLAINT_TYPES, default: "BREAKDOWN" },
    problemDescription: { type: String, required: true },
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM", index: true },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: "User", index: true },
    assignmentHistory: [AssignmentHistorySchema],
    targetVisitDate: { type: Date, index: true },
    targetResolutionDate: Date,
    actualVisitDate: Date,
    actualResolutionDate: Date,
    currentStatus: { type: String, enum: SERVICE_STATUSES, default: "NEW", index: true },
    statusHistory: [StatusHistorySchema],
    nextAction: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ServiceCallSchema.index({ customer: 1, site: 1, equipment: 1 });
ServiceCallSchema.index({ assignedEngineer: 1, currentStatus: 1 });
ServiceCallSchema.index({ priority: 1, currentStatus: 1 });
ServiceCallSchema.index({ createdAt: -1 });
ServiceCallSchema.index({ currentStatus: 1, targetVisitDate: 1 });

export const ServiceCall: Model<IServiceCall> =
  (mongoose.models.ServiceCall as Model<IServiceCall>) || mongoose.model<IServiceCall>("ServiceCall", ServiceCallSchema);
