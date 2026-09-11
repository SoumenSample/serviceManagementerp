import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const AMC_TYPES = ["COMPREHENSIVE", "NON_COMPREHENSIVE", "PREVENTIVE_MAINTENANCE", "OTHER"] as const;
export type AmcType = (typeof AMC_TYPES)[number];

export const PAYMENT_STATUSES = ["NOT_BILLED", "INVOICED", "PARTIAL", "PAID", "OVERDUE"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const AMC_STORED_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED", "RENEWED"] as const;
export type AmcStoredStatus = (typeof AMC_STORED_STATUSES)[number];

export interface IAmcDocument {
  url: string;
  publicId: string;
  fileName: string;
  resourceType: string;
  uploadedBy?: Types.ObjectId;
  uploadedAt: Date;
}

export interface IAmcRenewalHistory {
  previousAmcId: string;
  newAmcId: string;
  renewalDate: Date;
  renewedBy?: Types.ObjectId;
  previousEndDate?: Date;
  newStartDate: Date;
  newEndDate: Date;
  remarks?: string;
}

export interface IAmcContract extends Document {
  amcId: string;
  customer: Types.ObjectId;
  site: Types.ObjectId;
  equipmentIds: Types.ObjectId[];
  amcType: AmcType;
  startDate: Date;
  endDate: Date;
  contractAmount: number;
  paymentStatus: PaymentStatus;
  assignedEngineer?: Types.ObjectId;
  terms?: string;
  documents: IAmcDocument[];
  status: AmcStoredStatus;
  renewalHistory: IAmcRenewalHistory[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AmcDocumentSchema = new Schema<IAmcDocument>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    fileName: { type: String, required: true },
    resourceType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AmcRenewalSchema = new Schema<IAmcRenewalHistory>(
  {
    previousAmcId: { type: String, required: true },
    newAmcId: { type: String, required: true },
    renewalDate: { type: Date, default: Date.now },
    renewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    previousEndDate: Date,
    newStartDate: { type: Date, required: true },
    newEndDate: { type: Date, required: true },
    remarks: String,
  },
  { _id: false }
);

const AmcContractSchema = new Schema<IAmcContract>(
  {
    amcId: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    site: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    equipmentIds: [{ type: Schema.Types.ObjectId, ref: "Equipment", index: true }],
    amcType: { type: String, enum: AMC_TYPES, required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    contractAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "NOT_BILLED", index: true },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: "User", index: true },
    terms: String,
    documents: [AmcDocumentSchema],
    status: { type: String, enum: AMC_STORED_STATUSES, default: "ACTIVE", index: true },
    renewalHistory: [AmcRenewalSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AmcContractSchema.index({ amcId: 1 });
AmcContractSchema.index({ customer: 1, site: 1 });
AmcContractSchema.index({ equipmentIds: 1 });
AmcContractSchema.index({ endDate: 1, status: 1 });
AmcContractSchema.index({ createdAt: -1 });

export const AmcContract: Model<IAmcContract> =
  mongoose.models.AmcContract || mongoose.model<IAmcContract>("AmcContract", AmcContractSchema);
