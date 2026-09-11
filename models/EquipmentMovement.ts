import mongoose, { Schema, Document, Model, Types } from "mongoose";
export interface IEquipmentMovement extends Document {
  equipment: Types.ObjectId;
  fromSite?: Types.ObjectId;
  toSite: Types.ObjectId;
  serviceCall?: Types.ObjectId;
  visitId?: string;
  fromCustodian?: Types.ObjectId;
  toCustodian?: Types.ObjectId;
  fromLocation?: string;
  toLocation?: string;
  date: Date;
  reason?: string;
  purpose?: string;
  updatedBy?: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
}
const MovementSchema = new Schema<IEquipmentMovement>(
  { equipment: { type: Schema.Types.ObjectId, ref: "Equipment", required: true, index: true }, fromSite: { type: Schema.Types.ObjectId, ref: "Site" }, toSite: { type: Schema.Types.ObjectId, ref: "Site", required: true }, serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall" }, visitId: String, fromCustodian: { type: Schema.Types.ObjectId, ref: "User" }, toCustodian: { type: Schema.Types.ObjectId, ref: "User" }, fromLocation: String, toLocation: String, date: { type: Date, default: Date.now }, reason: String, purpose: String, updatedBy: { type: Schema.Types.ObjectId, ref: "User" }, remarks: String },
  { timestamps: { createdAt: true, updatedAt: false } }
);
export const EquipmentMovement: Model<IEquipmentMovement> = mongoose.models.EquipmentMovement || mongoose.model("EquipmentMovement", MovementSchema);
