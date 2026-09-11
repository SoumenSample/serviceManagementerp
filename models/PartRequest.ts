import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const PART_REQUEST_STATUSES = ["REQUIRED", "REQUESTED", "APPROVED", "DISPATCHED", "RECEIVED", "USED", "REJECTED", "CANCELLED"] as const;
export type PartRequestStatus = (typeof PART_REQUEST_STATUSES)[number];

export interface IPartRequest extends Document {
  requestId: string; // PR-2026-000001
  part: Types.ObjectId;
  quantity: number;
  serviceCall: Types.ObjectId;
  serviceVisit: Types.ObjectId;
  equipment?: Types.ObjectId;
  requestedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  dispatchedBy?: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  usedBy?: Types.ObjectId;
  requestedAt: Date;
  approvedAt?: Date;
  dispatchedAt?: Date;
  receivedAt?: Date;
  usedAt?: Date;
  status: PartRequestStatus;
  remarks?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartRequestSchema = new Schema<IPartRequest>(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    part: { type: Schema.Types.ObjectId, ref: "Part", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall", required: true, index: true },
    serviceVisit: { type: Schema.Types.ObjectId, ref: "ServiceVisit", required: true, index: true },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dispatchedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    usedBy: { type: Schema.Types.ObjectId, ref: "User" },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    dispatchedAt: Date,
    receivedAt: Date,
    usedAt: Date,
    status: { type: String, enum: PART_REQUEST_STATUSES, default: "REQUIRED", index: true },
    remarks: String,
    rejectionReason: String,
  },
  { timestamps: true }
);

PartRequestSchema.index({ serviceCall: 1, status: 1 });
PartRequestSchema.index({ serviceVisit: 1, status: 1 });
PartRequestSchema.index({ part: 1, status: 1 });
PartRequestSchema.index({ requestedBy: 1 });

export const PartRequest: Model<IPartRequest> =
  mongoose.models.PartRequest || mongoose.model<IPartRequest>("PartRequest", PartRequestSchema);
