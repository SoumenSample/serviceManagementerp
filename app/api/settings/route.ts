import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { SystemSetting, DEFAULT_SETTINGS } from "@/models/SystemSetting";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const settings = await SystemSetting.find().lean();
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) map[k] = v.value;
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json({ settings: map });
}

export async function PUT(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "users.manage") && auth.role !== "super_admin") return NextResponse.json({ error: "Forbidden settings.update" }, { status: 403 });
  const body = await req.json();
  await connectDB();
  // Capture before snapshot
  const beforeDocs = await SystemSetting.find().lean();
  const beforeMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) beforeMap[k] = v.value;
  for (const s of beforeDocs) beforeMap[s.key] = s.value;
  const allowed = ["companyName", "customerCare1", "customerCare2", "companyEmail"];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await SystemSetting.findOneAndUpdate({ key }, { value: String(body[key]), updatedBy: auth.sub }, { upsert: true, new: true });
    }
  }
  const settings = await SystemSetting.find().lean();
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) map[k] = v.value;
  for (const s of settings) map[s.key] = s.value;
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "UPDATE",
    module: "SETTINGS",
    recordId: "SYSTEM_SETTINGS",
    recordType: "SystemSetting",
    description: "Company settings updated",
    before: beforeMap as unknown as Record<string, unknown>,
    after: map as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json({ settings: map });
}
