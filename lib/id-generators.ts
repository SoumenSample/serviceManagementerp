import { connectDB } from "./db";
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export async function nextSequence(key: string): Promise<number> {
  await connectDB();
  const doc = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
}

export async function genCustomerId(): Promise<string> {
  const n = await nextSequence("customerId");
  return `CUST-${String(n).padStart(6, "0")}`;
}
export async function genSiteId(): Promise<string> {
  const n = await nextSequence("siteId");
  return `SITE-${String(n).padStart(6, "0")}`;
}
export async function genEquipmentId(): Promise<string> {
  const n = await nextSequence("equipmentId");
  return `UPS-${String(n).padStart(6, "0")}`;
}
export async function genAmcId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `amcId-${year}`;
  const n = await nextSequence(key);
  return `AMC-${year}-${String(n).padStart(6, "0")}`;
}
export async function genCallId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `callId-${year}`;
  const n = await nextSequence(key);
  return `SC-${year}-${String(n).padStart(6, "0")}`;
}
export async function genVisitId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `visitId-${year}`;
  const n = await nextSequence(key);
  return `VIS-${year}-${String(n).padStart(6, "0")}`;
}
export async function genPartId(): Promise<string> {
  const n = await nextSequence("partId");
  return `PART-${String(n).padStart(6, "0")}`;
}
export async function genPartRequestId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `partRequestId-${year}`;
  const n = await nextSequence(key);
  return `PR-${year}-${String(n).padStart(6, "0")}`;
}
export async function genMovementId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `movementId-${year}`;
  const n = await nextSequence(key);
  return `MOV-${year}-${String(n).padStart(6, "0")}`;
}
export async function genInvoiceId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoiceId-${year}`;
  const n = await nextSequence(key);
  return `INV-${year}-${String(n).padStart(6, "0")}`;
}
export async function genPaymentId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `paymentId-${year}`;
  const n = await nextSequence(key);
  return `PAY-${year}-${String(n).padStart(6, "0")}`;
}
export async function genExpenseId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `expenseId-${year}`;
  const n = await nextSequence(key);
  return `EXP-${year}-${String(n).padStart(6, "0")}`;
}
export function genQrToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
export async function genShiftId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `shiftId-${year}`;
  const n = await nextSequence(key);
  return `SHIFT-${year}-${String(n).padStart(6, "0")}`;
}
