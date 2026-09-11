import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { Site } from "@/models/Site";
import { siteSchema } from "@/lib/validators";
import { genSiteId } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "site.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const customer = searchParams.get("customer");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (customer) filter.customer = customer;
  if (status) filter.status = status;
  if (q) filter.$or = [{ siteName: { $regex: q, $options: "i" } }, { siteId: { $regex: q, $options: "i" } }, { city: { $regex: q, $options: "i" } }];
  const [items, total] = await Promise.all([
    Site.find(filter).populate("customer", "companyName customerId").populate("assignedEngineer", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Site.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "site.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = siteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const siteId = await genSiteId();
  const doc = await Site.create({
    ...parsed.data,
    siteId,
    customer: parsed.data.customer,
    assignedEngineer: parsed.data.assignedEngineer || undefined,
    email: parsed.data.email || undefined,
  });
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "SITE",
    recordId: siteId,
    recordObjectId: String(doc._id),
    recordType: "Site",
    description: `Site ${siteId} (${parsed.data.siteName}) created`,
    after: { siteId, siteName: parsed.data.siteName, customer: parsed.data.customer } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json(doc, { status: 201 });
}
