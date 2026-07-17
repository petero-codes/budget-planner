/**
 * In-process session registry for Development Toolkit (next dev only).
 * Not a production session store.
 */

export type RegisteredSession = {
  sessionId: string;
  userId: string;
  userAgent: string;
  browser: string;
  platform: string;
  iat: number;
  lastSeenAt: string;
};

const sessions = new Map<string, RegisteredSession>();
/** userId → revoke tokens issued before this unix seconds */
const revokedBeforeByUser = new Map<string, number>();
let globalRevokedBefore = 0;

function parseUa(ua: string): { browser: string; platform: string } {
  const platform = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS/i.test(ua)
      ? "macOS"
      : /Linux/i.test(ua)
        ? "Linux"
        : /Android/i.test(ua)
          ? "Android"
          : /iPhone|iPad/i.test(ua)
            ? "iOS"
            : "Unknown";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /Chrome\//i.test(ua)
      ? "Chrome"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Safari\//i.test(ua)
          ? "Safari"
          : "Unknown";
  return { browser, platform };
}

export function registerDevSession(input: {
  sessionId: string;
  userId: string;
  userAgent: string;
  iat: number;
}): void {
  const { browser, platform } = parseUa(input.userAgent || "");
  sessions.set(input.sessionId, {
    sessionId: input.sessionId,
    userId: input.userId,
    userAgent: input.userAgent || "",
    browser,
    platform,
    iat: input.iat,
    lastSeenAt: new Date().toISOString(),
  });
}

export function listDevSessions(): RegisteredSession[] {
  return Array.from(sessions.values()).sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt)
  );
}

export function invalidateDevSession(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  const before = revokedBeforeByUser.get(s.userId) ?? 0;
  revokedBeforeByUser.set(s.userId, Math.max(before, s.iat + 1));
  sessions.delete(sessionId);
  return true;
}

export function invalidateDevSessionsForUser(userId: string): number {
  const now = Math.floor(Date.now() / 1000);
  revokedBeforeByUser.set(userId, now);
  let n = 0;
  for (const [id, s] of Array.from(sessions.entries())) {
    if (s.userId === userId) {
      sessions.delete(id);
      n++;
    }
  }
  return n;
}

export function invalidateAllDevSessions(): number {
  const now = Math.floor(Date.now() / 1000);
  globalRevokedBefore = now;
  const n = sessions.size;
  sessions.clear();
  return n;
}

export function isSessionRevoked(userId: string, iat: number): boolean {
  if (iat <= globalRevokedBefore) return true;
  const userBefore = revokedBeforeByUser.get(userId);
  if (userBefore !== undefined && iat <= userBefore) return true;
  return false;
}

/** Test helper */
export function __resetDevSessionRegistry(): void {
  sessions.clear();
  revokedBeforeByUser.clear();
  globalRevokedBefore = 0;
}
