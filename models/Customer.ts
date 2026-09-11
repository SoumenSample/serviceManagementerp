import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICustomer extends Document {
  customerId: string;
  companyName: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  billingAddress?: string;
  gstNumber?: string;
  remarks?: string;
  status: "ACTIVE" | "INACTIVE";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true, index: true },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    billingAddress: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    remarks: { type: String },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CustomerSchema.index({ companyName: "text", contactPerson: "text", email: "text", customerId: "text" });
CustomerSchema.index({ status: 1, createdAt: -1 });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);
