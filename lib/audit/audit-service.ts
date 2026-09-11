import { connectDB } from "@/lib/db";
import { AuditLog, type AuditAction, type AuditModule } from "@/models/AuditLog";
import { nextSequence } from "@/lib/id-generators";
import type { Types } from "mongoose";

/**
 * Central audit service — append-only, sanitized, non-blocking for most operations.
 *
 * FAILURE POLICY:
 * - Business operation should NOT fail due to audit write failure for non-critical paths.
 * - This helper catches and logs audit failures server-side (console.error) and never throws
 *   unless caller explicitly opts into strict mode.
 * - For financial/security-critical operations, caller may await and handle strict=true.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "hash",
  "otp",
  "code",
  "codeHash",
  "smtp",
  "secret",
  "token",
  "apiKey",
  "credentials",
  "authorization",
]);

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      // drop sensitive keys entirely
      if (SENSITIVE_KEYS.has(lower) || lower.includes("password") || lower.includes("otp") || lower.includes("secret") || lower.includes("smtp") || lower === "codehash") {
        out[k] = "[REDACTED]";
        continue;
      }
      // avoid dumping huge binary/photo arrays
      if ((k === "beforePhotos" || k === "afterPhotos" || k === "customerSignature" || k === "receipt") && v) {
        out[k] = "[FILE_REF]";
        continue;
      }
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return value;
}

export function sanitizeAuditPayload(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!payload) return payload as null;
  return sanitizeValue(payload) as Record<string, unknown>;
}

export type CreateAuditParams = {
  actorId?: string | Types.ObjectId | null;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  module: AuditModule;
  recordId?: string | null;
  recordObjectId?: string | Types.ObjectId | null;
  recordType?: string | null;
  description: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

async function genAuditId(): Promise<string> {
  const n = await nextSequence("auditId");
  return `AUD-${String(n).padStart(6, "0")}`;
}

/**
 * Create audit log — never throws by default. Use strict=true to propagate errors.
 * AUDIT FEATURE TEMPORARILY HIDDEN — not deleted, just commented/disabled per request.
 * To re-enable, set AUDIT_ENABLED = true.
 */
const AUDIT_ENABLED = false; // <-- toggle to re-enable audit logging (was true)

export async function createAuditLog(params: CreateAuditParams, opts?: { strict?: boolean }): Promise<void> {
  // TEMPORARILY HIDDEN: early return keeps all audit call sites intact but prevents writes
  if (!AUDIT_ENABLED) return;
  try {
    await connectDB();
    const auditId = await genAuditId();
    const doc: Record<string, unknown> = {
      auditId,
      actor: params.actorId ? (params.actorId as unknown as string) : undefined,
      actorEmail: params.actorEmail || undefined,
      actorName: params.actorName || undefined,
      actorRole: params.actorRole || undefined,
      action: params.action,
      module: params.module,
      recordId: params.recordId || undefined,
      recordObjectId: params.recordObjectId ? (params.recordObjectId as unknown as string) : undefined,
      recordType: params.recordType || undefined,
      description: params.description,
      before: sanitizeAuditPayload(params.before as Record<string, unknown>) || null,
      after: sanitizeAuditPayload(params.after as Record<string, unknown>) || null,
      metadata: sanitizeAuditPayload(params.metadata as Record<string, unknown>) || null,
    };
    await AuditLog.create(doc);
  } catch (e) {
    console.error("[AUDIT_FAILED]", params.action, params.module, params.recordId, e);
    if (opts?.strict) throw e;
  }
}

/**
 * Helper to extract audit actor from JWTPayload and request headers metadata.
 */
export function buildActorMeta(auth: { sub: string; email: string; name: string; role: string } | null, req?: Request): CreateAuditParams["metadata"] & Pick<CreateAuditParams, "actorId" | "actorEmail" | "actorName" | "actorRole"> {
  // This is a type helper — actual construction done inline in callers that have auth
  return {} as never;
}

export function extractRequestMeta(req: Request): Record<string, unknown> | null {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
    const ua = req.headers.get("user-agent") || undefined;
    if (!ip && !ua) return null;
    return { ipAddress: ip, userAgent: ua };
  } catch {
    return null;
  }
}
