import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISystemSetting extends Document {
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SystemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
    category: { type: String, default: "company", index: true },
    description: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const SystemSetting: Model<ISystemSetting> =
  mongoose.models.SystemSetting || mongoose.model<ISystemSetting>("SystemSetting", SystemSettingSchema);

export const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description: string }> = {
  companyName: { value: "OM EPC SOLUTION", category: "company", description: "Company Name" },
  customerCare1: { value: "7981413743", category: "company", description: "Customer Care Number 1" },
  customerCare2: { value: "9163573904", category: "company", description: "Customer Care Number 2" },
  companyEmail: { value: "omepcsolution@gmail.com", category: "company", description: "Company Email" },
};
