import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const EXPENSE_CATEGORIES = ["PARTS", "TRAVEL", "LABOUR", "TRANSPORT", "ACCOMMODATION", "FOOD", "TOOLS", "OTHER"] as const;
export const EXPENSE_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const COST_SOURCES = ["FIELD", "SERVICE_CENTER", "INTERNAL"] as const;

export interface IServiceExpense extends Document {
  expenseId: string; // EXP-2026-000001
  serviceCall: Types.ObjectId;
  serviceVisit?: Types.ObjectId;
  customer?: Types.ObjectId;
  site?: Types.ObjectId;
  equipment?: Types.ObjectId;
  category: string;
  description: string;
  amount: number;
  expenseDate: Date;
  incurredBy: Types.ObjectId;
  submittedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvalDate?: Date;
  costSource: string;
  status: string;
  receipt?: { url: string; publicId: string; fileName?: string; mimeType?: string; size?: number };
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReceiptSchema = new Schema({ url: String, publicId: String, fileName: String, mimeType: String, size: Number }, { _id: false });

const ServiceExpenseSchema = new Schema<IServiceExpense>(
  {
    expenseId: { type: String, required: true, unique: true, index: true },
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall", required: true, index: true },
    serviceVisit: { type: Schema.Types.ObjectId, ref: "ServiceVisit", index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    site: { type: Schema.Types.ObjectId, ref: "Site" },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment" },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true, index: true },
    incurredBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvalDate: Date,
    costSource: { type: String, enum: COST_SOURCES, default: "FIELD", index: true },
    status: { type: String, enum: EXPENSE_STATUSES, default: "DRAFT", index: true },
    receipt: ReceiptSchema,
    remarks: String,
  },
  { timestamps: true }
);

ServiceExpenseSchema.index({ serviceCall: 1, status: 1 });
ServiceExpenseSchema.index({ serviceVisit: 1, status: 1 });
ServiceExpenseSchema.index({ serviceCall: 1, serviceVisit: 1 });

if (mongoose.models.ServiceExpense) delete mongoose.models.ServiceExpense;
export const ServiceExpense: Model<IServiceExpense> =
  mongoose.models.ServiceExpense || mongoose.model<IServiceExpense>("ServiceExpense", ServiceExpenseSchema);
