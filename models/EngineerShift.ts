import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const SHIFT_STATUSES = ["ACTIVE", "ENDED"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export interface IEngineerShift extends Document {
  shiftId: string; // SHIFT-2026-000001
  engineer: Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  status: ShiftStatus;
  lastLocationAt?: Date;
  lastLatitude?: number;
  lastLongitude?: number;
  lastAddress?: string;
  lastAccuracy?: number;
  locationRefreshRequestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EngineerShiftSchema = new Schema<IEngineerShift>(
  {
    shiftId: { type: String, required: true, unique: true, index: true },
    engineer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: Date,
    status: { type: String, enum: SHIFT_STATUSES, default: "ACTIVE", index: true },
    lastLocationAt: Date,
    lastLatitude: Number,
    lastLongitude: Number,
    lastAddress: String,
    lastAccuracy: Number,
    locationRefreshRequestedAt: Date,
  },
  { timestamps: true }
);

EngineerShiftSchema.index({ engineer: 1, status: 1 });
EngineerShiftSchema.index({ engineer: 1, startedAt: -1 });
EngineerShiftSchema.index({ status: 1, lastLocationAt: -1 });

export const EngineerShift: Model<IEngineerShift> =
  (mongoose.models.EngineerShift as Model<IEngineerShift>) ||
  mongoose.model<IEngineerShift>("EngineerShift", EngineerShiftSchema);
