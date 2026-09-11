import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const VISIT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const SIGNATURE_REASONS = ["CUSTOMER_UNAVAILABLE", "CUSTOMER_REFUSED", "SITE_CLOSED", "OTHER"] as const;
export const VISIT_PURPOSES = ["INITIAL_INSPECTION", "DIAGNOSIS", "FOLLOW_UP_REPAIR", "PARTS_INSTALLATION", "TESTING", "FINAL_INSTALLATION", "SERVICE_CENTER_REPAIR", "RETURN_REINSTALLATION", "OTHER"] as const;
export type VisitPurpose = (typeof VISIT_PURPOSES)[number];

export interface IServiceVisit extends Document {
  visitId: string; // VIS-2026-000001 immutable
  serviceCall: Types.ObjectId;
  engineer: Types.ObjectId;
  visitDate: Date;
  visitTime?: string;
  status: VisitStatus;
  visitPurpose?: VisitPurpose;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsTimestamp?: Date;
  gpsAccuracy?: number;
  completionLatitude?: number;
  completionLongitude?: number;
  completionTimestamp?: Date;
  completionGpsAccuracy?: number;
  startedAt?: Date;
  completedAt?: Date;
  problemFound?: string;
  diagnosis?: string;
  workDone?: string;
  equipmentCondition?: string;
  partsUsed?: string[];
  partsRequired?: string[];
  beforePhotos?: { url: string; publicId: string; fileName?: string; resourceType?: string }[];
  afterPhotos?: { url: string; publicId: string; fileName?: string; resourceType?: string }[];
  customerSignature?: { url: string; publicId: string };
  signatureReason?: string;
  engineerRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PhotoSchema = new Schema({ url: String, publicId: String, fileName: String, resourceType: String }, { _id: false });

const ServiceVisitSchema = new Schema<IServiceVisit>(
  {
    visitId: { type: String, required: true, unique: true, index: true },
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall", required: true, index: true },
    engineer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    visitDate: { type: Date, required: true, index: true },
    visitTime: String,
    status: { type: String, enum: VISIT_STATUSES, default: "NOT_STARTED", index: true },
    visitPurpose: { type: String, enum: VISIT_PURPOSES, default: "OTHER" },
    gpsLatitude: Number,
    gpsLongitude: Number,
    gpsTimestamp: Date,
    gpsAccuracy: Number,
    completionLatitude: Number,
    completionLongitude: Number,
    completionTimestamp: Date,
    completionGpsAccuracy: Number,
    startedAt: Date,
    completedAt: Date,
    problemFound: String,
    diagnosis: String,
    workDone: String,
    equipmentCondition: String,
    partsUsed: [String],
    partsRequired: [String],
    beforePhotos: [PhotoSchema],
    afterPhotos: [PhotoSchema],
    customerSignature: PhotoSchema,
    signatureReason: String,
    engineerRemarks: String,
  },
  { timestamps: true }
);

ServiceVisitSchema.index({ serviceCall: 1, visitDate: -1 });
ServiceVisitSchema.index({ engineer: 1, visitDate: -1 });
ServiceVisitSchema.index({ serviceCall: 1, status: 1 });

if (mongoose.models.ServiceVisit) delete mongoose.models.ServiceVisit;
export const ServiceVisit: Model<IServiceVisit> =
  mongoose.models.ServiceVisit || mongoose.model<IServiceVisit>("ServiceVisit", ServiceVisitSchema);
