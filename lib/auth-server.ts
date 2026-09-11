import { cookies } from "next/headers";
import { verifyJWT, type JWTPayload } from "./jwt";

export const AUTH_COOKIE = "espsoln_token";

export async function getAuth(): Promise<JWTPayload | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyJWT(token);
}

export async function requireAuth(): Promise<JWTPayload> {
  const auth = await getAuth();
  if (!auth) throw new Error("Unauthorized");
  return auth;
}
