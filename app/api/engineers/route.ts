import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { User } from "@/models/User";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "equipment.view") && !hasPermission(auth.role, "site.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const engineers = await User.find({ role: "engineer", isActive: true }).select("name email employeeId designation").sort({ name: 1 }).lean();
  return NextResponse.json({ items: engineers });
}
