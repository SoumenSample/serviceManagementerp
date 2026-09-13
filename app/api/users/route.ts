import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission, canCreateUser } from "@/lib/rbac";
import { User } from "@/models/User";
import { createUserSchema } from "@/lib/validators";

function canManageUsers(role: string): boolean {
  return hasPermission(role as never, "users.manage") || hasPermission(role as never, "users.view");
}

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(auth.role)) return NextResponse.json({ error: "Forbidden users.view" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const role = searchParams.get("role");
  const active = searchParams.get("active");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  // Re-check requester isActive
  const requester = await User.findById(auth.sub);
  if (!requester || !requester.isActive) return NextResponse.json({ error: "Account deactivated" }, { status: 403 });

  const filter: Record<string, unknown> = {};
  if (role && role !== "all") filter.role = role;
  if (active && active !== "all") filter.isActive = active === "true";
  if (q) filter.$or = [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }, { mobile: { $regex: q, $options: "i" } }];

  const [items, total] = await Promise.all([
    User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "users.manage") && !hasPermission(auth.role, "users.create")) return NextResponse.json({ error: "Forbidden users.create" }, { status: 403 });
  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const requester = await User.findById(auth.sub);
  if (!requester || !requester.isActive) return NextResponse.json({ error: "Account deactivated" }, { status: 403 });

  // Hierarchy protection: manager can create coordinator/engineer/accounts/manager but not super_admin
  if (!canCreateUser(auth.role as never, parsed.data.role as never)) return NextResponse.json({ error: "Forbidden: insufficient privilege to create role " + parsed.data.role }, { status: 403 });
  // Super admin protection: only super_admin can create super_admin (redundant with canCreateUser but explicit)
  if (parsed.data.role === "super_admin" && auth.role !== "super_admin") return NextResponse.json({ error: "Only super_admin can create super_admin" }, { status: 403 });

  const exists = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const doc = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    mobile: parsed.data.mobile || undefined,
    passwordHash,
    role: parsed.data.role,
    employeeId: parsed.data.employeeId || undefined,
    designation: parsed.data.designation || undefined,
    isActive: parsed.data.isActive,
  });
  const safe = await User.findById(doc._id).select("-passwordHash").lean();
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "USER",
    recordId: doc.email,
    recordObjectId: String(doc._id),
    recordType: "User",
    description: `User ${doc.email} created with role ${doc.role}`,
    after: { email: doc.email, role: doc.role, name: doc.name } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});
  return NextResponse.json(safe, { status: 201 });
}
