import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice extends Document {
  invoiceId: string; // INV-2026-000001
  customer: Types.ObjectId;
  amcContract?: Types.ObjectId;
  serviceCall?: Types.ObjectId;
  invoiceDate: Date;
  dueDate?: Date;
  amount: number; // without tax
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: InvoiceStatus;
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceId: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    amcContract: { type: Schema.Types.ObjectId, ref: "AmcContract", index: true },
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall" },
    invoiceDate: { type: Date, required: true, index: true },
    dueDate: Date,
    amount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: INVOICE_STATUSES, default: "DRAFT", index: true },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

InvoiceSchema.index({ customer: 1, paymentStatus: 1 });
InvoiceSchema.index({ amcContract: 1 });

export const Invoice: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);
