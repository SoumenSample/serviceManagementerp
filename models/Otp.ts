import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IOtp extends Document {
  serviceCall: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdBy?: Types.ObjectId;
  verified: boolean;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall", required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    attempts: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    verified: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

OtpSchema.index({ serviceCall: 1, createdAt: -1 });

export const Otp: Model<IOtp> = mongoose.models.Otp || mongoose.model<IOtp>("Otp", OtpSchema);
