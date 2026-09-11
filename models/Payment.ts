import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"] as const;

export interface IPayment extends Document {
  paymentId: string; // PAY-2026-000001
  invoice: Types.ObjectId;
  customer: Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNumber?: string;
  receivedBy?: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, default: Date.now, index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "OTHER" },
    referenceNumber: String,
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    remarks: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
