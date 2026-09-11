import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { AmcContract } from "@/models/AmcContract";
import { getComputedAmcStatus } from "@/lib/amc-helpers";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const all = await AmcContract.find({ status: { $nin: ["CANCELLED", "RENEWED"] } }).select("startDate endDate status").lean();
  let active = 0, expiring15 = 0, expiring30 = 0, expired = 0;
  for (const doc of all as unknown as { startDate: string; endDate: string; status: string }[]) {
    const computed = getComputedAmcStatus(doc.startDate, doc.endDate, doc.status as never);
    if (computed === "ACTIVE") active++;
    else if (computed === "EXPIRING_15") expiring15++;
    else if (computed === "EXPIRING_30") expiring30++;
    else if (computed === "EXPIRED") expired++;
  }
  // Provide both mutually exclusive buckets and legacy 30-days inclusive for clarity
  return NextResponse.json({ active, expiring15, expiring30, expiring30Inclusive: expiring15 + expiring30, expired, total: all.length });
}
