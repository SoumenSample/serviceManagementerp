import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IEngineerLocation extends Document {
  engineer: Types.ObjectId;
  shift: Types.ObjectId;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  capturedAt: Date;
  createdAt: Date;
}

const EngineerLocationSchema = new Schema<IEngineerLocation>(
  {
    engineer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    shift: { type: Schema.Types.ObjectId, ref: "EngineerShift", required: true, index: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: Number,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    capturedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EngineerLocationSchema.index({ engineer: 1, capturedAt: -1 });
EngineerLocationSchema.index({ shift: 1, capturedAt: -1 });
EngineerLocationSchema.index({ engineer: 1, shift: 1, capturedAt: -1 });

export const EngineerLocation: Model<IEngineerLocation> =
  (mongoose.models.EngineerLocation as Model<IEngineerLocation>) ||
  mongoose.model<IEngineerLocation>("EngineerLocation", EngineerLocationSchema);
