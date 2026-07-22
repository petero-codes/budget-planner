import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing with Node's built-in scrypt (no external deps).
 * Format: scrypt$N$r$p$salt$hash (all base64url where binary).
 */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const derived = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface PasswordPolicyIssue {
  message: string;
}

export function checkPasswordPolicy(password: string): PasswordPolicyIssue[] {
  const issues: PasswordPolicyIssue[] = [];
  if (password.length < 8) {
    issues.push({ message: "Password must be at least 8 characters" });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    issues.push({ message: "Password must contain letters and numbers" });
  }
  return issues;
}
