import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission, canEditUser } from "@/lib/rbac";
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
  const { id } = await params;
  const body = await req.json();
  const isSelf = String(auth.sub) === String(id);
  // For non-self edits, require users.manage / users.update. Self-edit allows limited fields without that perm (role/isActive changes still blocked below)
  if (!isSelf && !hasPermission(auth.role, "users.manage") && !hasPermission(auth.role, "users.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Allow password reset via same route if newPassword present
  if (body.newPassword) {
    if (!hasPermission(auth.role, "users.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = adminPasswordResetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
    await connectDB();
    const targetForReset = await User.findById(id).select("role email");
    if (!targetForReset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canEditUser(auth.role as never, targetForReset.role as never, auth.sub, String(targetForReset._id))) {
      return NextResponse.json({ error: "Forbidden: manager cannot reset super_admin password" }, { status: 403 });
    }
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
  // Self-edit cannot change privileged fields without permission
  if (isSelf && (parsed.data.role !== undefined || parsed.data.isActive !== undefined)) {
    if (!hasPermission(auth.role, "users.manage") && !hasPermission(auth.role, "users.update")) {
      return NextResponse.json({ error: "Forbidden: cannot change role/status on own profile" }, { status: 403 });
    }
  }
  await connectDB();
  const target = await User.findById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Hierarchy check: super_admin can edit everyone, manager can edit everyone except super_admin
  // Self-edit bypasses hierarchy but still respects permission + super_admin protections
  if (!canEditUser(auth.role as never, target.role as never, auth.sub, String(target._id))) {
    return NextResponse.json({ error: "Forbidden: insufficient privilege to edit this profile (manager cannot edit super_admin)" }, { status: 403 });
  }
  // Also prevent manager from promoting target to super_admin via this route (already covered but explicit)
  if (parsed.data.role && !canEditUser(auth.role as never, parsed.data.role as never, auth.sub, String(target._id)) && parsed.data.role === "super_admin") {
    return NextResponse.json({ error: "Forbidden: manager cannot create/promote to super_admin" }, { status: 403 });
  }

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
