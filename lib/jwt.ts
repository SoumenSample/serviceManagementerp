import * as jose from "jose";
import type { Role } from "./rbac";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-32chars!!";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const secret = new TextEncoder().encode(JWT_SECRET);

export type JWTPayload = {
  sub: string;
  email: string;
  role: Role;
  name: string;
};

export async function signJWT(payload: JWTPayload): Promise<string> {
  return await new jose.SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .setSubject(payload.sub)
    .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}
