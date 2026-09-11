import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IPart extends Document {
  partId: string; // PART-000001
  partNumber: string; // SKU unique
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  unit?: string;
  unitCost?: number;
  minimumStockLevel: number;
  active: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PartSchema = new Schema<IPart>(
  {
    partId: { type: String, required: true, unique: true, index: true },
    partNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
  description: String,
  category: { type: String, trim: true, index: true },
  brand: String,
  unit: { type: String, default: "pcs" },
  unitCost: { type: Number, default: 0, min: 0 },
  minimumStockLevel: { type: Number, default: 5, min: 0 },
  active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PartSchema.index({ name: "text", partNumber: "text", description: "text" });
PartSchema.index({ active: 1, category: 1 });

export const Part: Model<IPart> = mongoose.models.Part || mongoose.model<IPart>("Part", PartSchema);
