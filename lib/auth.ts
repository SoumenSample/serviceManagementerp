import { getAuth } from "./auth-server";
import type { Role } from "./rbac";

export type User = {
  name: string;
  email: string;
  role: Role;
  id: string;
};

export async function getCurrentUser(): Promise<User | null> {
  const auth = await getAuth();
  if (!auth) return null;
  return { name: auth.name, email: auth.email, role: auth.role, id: auth.sub };
}
