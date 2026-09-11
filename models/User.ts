import mongoose, { Schema, Document, Model } from "mongoose";
import { ROLES, type Role } from "@/lib/rbac";

export interface IUser extends Document {
  name: string;
  email: string;
  mobile?: string;
  passwordHash: string;
  role: Role;
  employeeId?: string;
  designation?: string;
  profileImage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobile: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "engineer", index: true },
    employeeId: { type: String, trim: true, sparse: true },
    designation: { type: String, trim: true },
    profileImage: { type: String },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ employeeId: 1 }, { sparse: true });
UserSchema.index({ name: 1 });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
