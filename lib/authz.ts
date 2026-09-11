import { NextResponse } from "next/server";
import { getAuth } from "./auth-server";
import { hasPermission, type Permission, type Role } from "./rbac";

export async function requirePermission(permission: Permission) {
  const auth = await getAuth();
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(auth.role as Role, permission)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { auth };
}
