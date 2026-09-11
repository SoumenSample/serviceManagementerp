import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISite extends Document {
  siteId: string;
  customer: Types.ObjectId;
  siteName: string;
  siteAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  assignedEngineer?: Types.ObjectId;
  remarks?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const SiteSchema = new Schema<ISite>(
  {
    siteId: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    siteName: { type: String, required: true, trim: true, index: true },
    siteAddress: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    gpsLatitude: { type: Number },
    gpsLongitude: { type: Number },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: "User", index: true },
    remarks: { type: String },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
  },
  { timestamps: true }
);

SiteSchema.index({ siteName: "text", siteAddress: "text", city: "text" });
SiteSchema.index({ customer: 1, status: 1 });
SiteSchema.index({ assignedEngineer: 1 });

export const Site: Model<ISite> = mongoose.models.Site || mongoose.model<ISite>("Site", SiteSchema);
