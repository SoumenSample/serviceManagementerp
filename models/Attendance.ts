import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const ATTENDANCE_STATUSES = ["ACTIVE", "ENDED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface IAttendanceSession {
  loginAt: Date;
  logoutAt?: Date;
}

export interface IAttendance extends Document {
  attendanceId: string; // ATT-2026-000001
  user: Types.ObjectId;
  role: string;
  attendanceDate: string; // YYYY-MM-DD in Asia/Kolkata
  startedAt: Date; // first login of day
  endedAt?: Date; // last logout when all sessions closed
  status: AttendanceStatus;
  lastActivityAt?: Date;
  sessions: IAttendanceSession[];
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    loginAt: { type: Date, required: true },
    logoutAt: Date,
  },
  { _id: false }
);

const AttendanceSchema = new Schema<IAttendance>(
  {
    attendanceId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true, index: true },
    attendanceDate: { type: String, index: true, sparse: true }, // YYYY-MM-DD IST, sparse for backward compat
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: Date,
    status: { type: String, enum: ATTENDANCE_STATUSES, default: "ACTIVE", index: true },
    lastActivityAt: Date,
    sessions: { type: [AttendanceSessionSchema], default: [] },
  },
  { timestamps: true }
);

// Daily uniqueness: one record per user per calendar day (IST) - sparse allows old records without date
AttendanceSchema.index({ user: 1, attendanceDate: 1 }, { unique: true, sparse: true });

// Backward compatibility indexes
AttendanceSchema.index({ user: 1, status: 1 });
AttendanceSchema.index({ user: 1, startedAt: -1 });
AttendanceSchema.index({ status: 1, startedAt: -1 });
AttendanceSchema.index({ role: 1, status: 1 });
AttendanceSchema.index({ attendanceDate: -1 });

export const Attendance: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
