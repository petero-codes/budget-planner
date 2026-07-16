/**
 * HMAC-SHA256 signed session tokens (Edge + Node via Web Crypto).
 * Format: `{payloadB64}.{sigB64}` where payload is JSON:
 *   { sub, exp, roles, perms }
 * Signature covers the payloadB64 string.
 */

export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — matches cookie maxAge

export type SessionClaims = {
  userId: string;
  roleCodes: string[];
  permissionCodes: string[];
  /** Issued-at unix seconds — used for toolkit session revocation. */
  iat: number;
};

const DEV_FALLBACK_SECRET =
  "dev-only-session-secret-min-32-chars-change-me";

function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters in production"
    );
  }
  return DEV_FALLBACK_SECRET;
}

function toBase64Url(buf: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buf === "string") {
    bytes = new TextEncoder().encode(buf);
  } else if (buf instanceof ArrayBuffer) {
    bytes = new Uint8Array(buf);
  } else {
    bytes = buf;
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  }
  return diff === 0;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return toBase64Url(mac);
}

export type CreateSessionOptions = {
  roleCodes?: string[];
  permissionCodes?: string[];
  nowMs?: number;
};

/** Create a signed session token for the given user id and RBAC claims. */
export async function createSessionToken(
  userId: string,
  options: CreateSessionOptions = {}
): Promise<string> {
  if (!userId) throw new Error("userId is required");
  const nowMs = options.nowMs ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const body = JSON.stringify({
    sub: userId,
    iat,
    exp,
    roles: options.roleCodes ?? [],
    perms: options.permissionCodes ?? [],
  });
  const payloadB64 = toBase64Url(body);
  const sig = await hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a session token and return claims, or null if invalid / expired.
 * Rejects unsigned raw user ids and legacy 3-part tokens without RBAC payload.
 */
export async function verifySessionClaims(
  token: string,
  nowMs: number = Date.now()
): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  let expected: string;
  try {
    expected = await hmacSign(payloadB64);
  } catch {
    return null;
  }
  if (!timingSafeEqualStr(sig, expected)) return null;

  try {
    const raw = JSON.parse(fromBase64Url(payloadB64)) as {
      sub?: unknown;
      exp?: unknown;
      iat?: unknown;
      roles?: unknown;
      perms?: unknown;
    };
    if (typeof raw.sub !== "string" || !raw.sub) return null;
    if (typeof raw.exp !== "number" || !Number.isFinite(raw.exp)) return null;
    if (raw.exp * 1000 < nowMs) return null;
    const iat =
      typeof raw.iat === "number" && Number.isFinite(raw.iat)
        ? raw.iat
        : Math.floor(raw.exp - SESSION_TTL_SECONDS);
    const roleCodes = Array.isArray(raw.roles)
      ? raw.roles.filter((r): r is string => typeof r === "string")
      : [];
    const permissionCodes = Array.isArray(raw.perms)
      ? raw.perms.filter((p): p is string => typeof p === "string")
      : [];
    return { userId: raw.sub, roleCodes, permissionCodes, iat };
  } catch {
    return null;
  }
}

/** Convenience: verify and return user id only. */
export async function verifySessionToken(
  token: string,
  nowMs: number = Date.now()
): Promise<string | null> {
  const claims = await verifySessionClaims(token, nowMs);
  return claims?.userId ?? null;
}
