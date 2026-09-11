import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IInventory extends Document {
  part: Types.ObjectId;
  location: string;
  quantityOnHand: number;
  quantityReserved: number;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    part: { type: Schema.Types.ObjectId, ref: "Part", required: true, index: true },
    location: { type: String, default: "MAIN", trim: true, index: true },
    quantityOnHand: { type: Number, default: 0, min: 0 },
    quantityReserved: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

InventorySchema.index({ part: 1, location: 1 }, { unique: true });
InventorySchema.virtual("quantityAvailable").get(function () {
  return this.quantityOnHand - this.quantityReserved;
});
InventorySchema.set("toJSON", { virtuals: true });
InventorySchema.set("toObject", { virtuals: true });

export const Inventory: Model<IInventory> = mongoose.models.Inventory || mongoose.model<IInventory>("Inventory", InventorySchema);
