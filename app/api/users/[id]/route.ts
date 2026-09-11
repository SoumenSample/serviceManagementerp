import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { User } from "@/models/User";
import { updateUserSchema, adminPasswordResetSchema } from "@/lib/validators";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "users.manage") && !hasPermission(auth.role, "users.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; await connectDB();
  const doc = await User.findById(id).select("-passwordHash").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "users.manage") && !hasPermission(auth.role, "users.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  // Allow password reset via same route if newPassword present
  if (body.newPassword) {
    if (!hasPermission(auth.role, "users.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = adminPasswordResetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
    await connectDB();
    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    const doc = await User.findByIdAndUpdate(id, { passwordHash: hash }, { new: true }).select("-passwordHash");
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "UPDATE",
      module: "USER",
      recordId: doc.email,
      recordObjectId: String(doc._id),
      recordType: "User",
      description: `Password reset for user ${doc.email} by admin`,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
    return NextResponse.json(doc);
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const target = await User.findById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Super admin protection
  if (parsed.data.role === "super_admin" && auth.role !== "super_admin") return NextResponse.json({ error: "Only super_admin can set super_admin" }, { status: 403 });
  if (target.role === "super_admin" && parsed.data.role && parsed.data.role !== "super_admin" && auth.role !== "super_admin") return NextResponse.json({ error: "Only super_admin can downgrade super_admin" }, { status: 403 });

  // Prevent last super_admin removal
  if (parsed.data.role && parsed.data.role !== "super_admin" && target.role === "super_admin") {
    const count = await User.countDocuments({ role: "super_admin", isActive: true, _id: { $ne: id } });
    if (count === 0) return NextResponse.json({ error: "Cannot downgrade last active super_admin" }, { status: 400 });
  }
  if (parsed.data.isActive === false) {
    // Self-deactivation protection
    if (String(auth.sub) === String(id)) return NextResponse.json({ error: "Cannot deactivate own account" }, { status: 400 });
    if (target.role === "super_admin") {
      const count = await User.countDocuments({ role: "super_admin", isActive: true, _id: { $ne: id } });
      if (count === 0) return NextResponse.json({ error: "Cannot deactivate last active super_admin" }, { status: 400 });
    }
  }
  // Self-lockout for role change of self if super_admin downgrade
  if (String(auth.sub) === String(id) && parsed.data.role && parsed.data.role !== "super_admin" && target.role === "super_admin") {
    return NextResponse.json({ error: "Cannot downgrade own super_admin role" }, { status: 400 });
  }

  if (parsed.data.email) {
    const dup = await User.findOne({ email: parsed.data.email.toLowerCase(), _id: { $ne: id } });
    if (dup) return NextResponse.json({ error: "Email exists" }, { status: 409 });
    parsed.data.email = parsed.data.email.toLowerCase() as never;
  }

  const doc = await User.findByIdAndUpdate(id, parsed.data, { new: true }).select("-passwordHash");
  if (doc) {
    const changes: Record<string, unknown> = {};
    if (parsed.data.role && parsed.data.role !== target.role) changes.role = `${target.role} → ${parsed.data.role}`;
    if (parsed.data.isActive !== undefined && parsed.data.isActive !== target.isActive) changes.isActive = `${target.isActive} → ${parsed.data.isActive}`;
    const action = parsed.data.role && parsed.data.role !== target.role ? "UPDATE" : parsed.data.isActive === false ? "UPDATE" : "UPDATE";
    createAuditLog({
      actorId: auth.sub,
      actorEmail: auth.email,
      actorName: auth.name,
      actorRole: auth.role,
      action: "UPDATE",
      module: "USER",
      recordId: doc.email,
      recordObjectId: String(doc._id),
      recordType: "User",
      description: changes.role ? `User ${doc.email} role changed ${changes.role}` : parsed.data.isActive === false ? `User ${doc.email} deactivated` : parsed.data.isActive === true && !target.isActive ? `User ${doc.email} activated` : `User ${doc.email} updated`,
      before: { role: target.role, isActive: target.isActive } as unknown as Record<string, unknown>,
      after: { role: doc.role, isActive: doc.isActive } as unknown as Record<string, unknown>,
      metadata: extractRequestMeta(req) as Record<string, unknown>,
    }).catch(() => {});
  }
  return NextResponse.json(doc);
}
