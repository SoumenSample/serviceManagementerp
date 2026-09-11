import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type EquipmentStatus = "ACTIVE" | "UNDER_REPAIR" | "DECOMMISSIONED" | "TRANSFERRED" | "REPLACED";
export type CurrentCondition = "GOOD" | "FAIR" | "POOR" | "NOT_WORKING";

export interface IEquipment extends Omit<Document, "model"> {
  equipmentId: string; // UPS-000123 immutable
  assetId?: string;
  customer: Types.ObjectId;
  site: Types.ObjectId;
  equipmentType?: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  kvaCapacity?: string;
  installationDate?: Date;
  batteryMake?: string;
  batteryModel?: string;
  batteryQuantity?: number;
  batteryCapacity?: string;
  batteryInstallationDate?: Date;
  warrantyStartDate?: Date;
  warrantyEndDate?: Date;
  amcContract?: Types.ObjectId;
  amcStartDate?: Date;
  amcEndDate?: Date;
  amcStatus?: string;
  currentCondition?: CurrentCondition;
  equipmentStatus: EquipmentStatus;
  qrToken?: string;
  equipmentPhotos?: string[];
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EquipmentSchema = new Schema<IEquipment>(
  {
    equipmentId: { type: String, required: true, unique: true, index: true },
    assetId: { type: String, trim: true, sparse: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    site: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    equipmentType: { type: String, trim: true, index: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true, index: true },
    kvaCapacity: { type: String, trim: true },
    installationDate: { type: Date },
    batteryMake: { type: String },
    batteryModel: { type: String },
    batteryQuantity: { type: Number },
    batteryCapacity: { type: String },
    batteryInstallationDate: { type: Date },
    warrantyStartDate: { type: Date },
    warrantyEndDate: { type: Date },
    amcContract: { type: Schema.Types.ObjectId, ref: "AmcContract" },
    amcStartDate: { type: Date },
    amcEndDate: { type: Date, index: true },
    amcStatus: { type: String },
    currentCondition: { type: String, enum: ["GOOD", "FAIR", "POOR", "NOT_WORKING"] },
    equipmentStatus: { type: String, enum: ["ACTIVE", "UNDER_REPAIR", "DECOMMISSIONED", "TRANSFERRED", "REPLACED"], default: "ACTIVE", index: true },
    qrToken: { type: String, unique: true, sparse: true, index: true },
    equipmentPhotos: [{ type: String }],
    remarks: { type: String },
  },
  { timestamps: true }
);

EquipmentSchema.index({ serialNumber: 1 });
EquipmentSchema.index({ customer: 1, site: 1 });
EquipmentSchema.index({ equipmentStatus: 1 });
EquipmentSchema.index({ make: 1 });
EquipmentSchema.index({ model: 1 });
EquipmentSchema.index({ make: "text", model: "text", serialNumber: "text", equipmentId: "text" });

export const Equipment: Model<IEquipment> =
  mongoose.models.Equipment || mongoose.model<IEquipment>("Equipment", EquipmentSchema);
