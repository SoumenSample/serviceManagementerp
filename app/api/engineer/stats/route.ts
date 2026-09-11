import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const engineerId = auth.sub;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [assigned, pending, completed, critical, todayVisits] = await Promise.all([
    ServiceCall.countDocuments({ assignedEngineer: engineerId, currentStatus: { $nin: ["CLOSED", "CANCELLED"] } }),
    ServiceCall.countDocuments({ assignedEngineer: engineerId, currentStatus: { $in: ["NEW", "ASSIGNED", "VISIT_SCHEDULED", "PARTS_REQUIRED", "ON_HOLD"] } }),
    ServiceCall.countDocuments({ assignedEngineer: engineerId, currentStatus: "CLOSED" }),
    ServiceCall.countDocuments({ assignedEngineer: engineerId, priority: "CRITICAL", currentStatus: { $nin: ["CLOSED", "CANCELLED"] } }),
    ServiceVisit.countDocuments({ engineer: engineerId, visitDate: { $gte: today, $lt: tomorrow } }),
  ]);

  // Also fetch assigned calls for list
  const assignedCalls = await ServiceCall.find({ assignedEngineer: engineerId, currentStatus: { $nin: ["CLOSED", "CANCELLED"] } })
    .populate("site", "siteName")
    .populate("equipment", "equipmentId")
    .sort({ priority: -1, createdAt: -1 })
    .limit(10)
    .lean();

  return NextResponse.json({ assigned, pending, completed, critical, todayVisits, assignedCalls });
}
