import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const MOVEMENT_TYPES = ["IN", "OUT", "RESERVE", "RELEASE", "ADJUSTMENT", "RETURN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export interface IStockMovement extends Document {
  movementId: string; // MOV-2026-000001
  part: Types.ObjectId;
  inventory: Types.ObjectId;
  movementType: MovementType;
  quantity: number;
  referenceType?: string; // PartRequest, INVENTORY, ADJUSTMENT
  referenceId?: string;
  serviceCall?: Types.ObjectId;
  serviceVisit?: Types.ObjectId;
  partRequest?: Types.ObjectId;
  performedBy?: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    movementId: { type: String, required: true, unique: true, index: true },
    part: { type: Schema.Types.ObjectId, ref: "Part", required: true, index: true },
    inventory: { type: Schema.Types.ObjectId, ref: "Inventory", required: true, index: true },
    movementType: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    referenceType: String,
    referenceId: String,
    serviceCall: { type: Schema.Types.ObjectId, ref: "ServiceCall" },
    serviceVisit: { type: Schema.Types.ObjectId, ref: "ServiceVisit" },
    partRequest: { type: Schema.Types.ObjectId, ref: "PartRequest" },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    remarks: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockMovementSchema.index({ part: 1, createdAt: -1 });
StockMovementSchema.index({ partRequest: 1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement || mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);
