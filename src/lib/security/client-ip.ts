/**
 * Central client IP extraction for reverse proxies / load balancers.
 *
 * Use only for rate limiting, audit trails, logging, and diagnostics.
 * Never use the result for authentication or authorization (RBAC) —
 * clients can spoof X-Forwarded-For / X-Real-IP when the app is not
 * behind a trusted proxy that overwrites these headers.
 */

type HeaderSource = {
  get(name: string): string | null;
};

export type ClientIpRequest = {
  /** Platform-provided IP when available (e.g. NextRequest.ip). */
  ip?: string | null;
  headers: HeaderSource;
};

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the client IP from a request-like object.
 * Order: X-Forwarded-For (leftmost) → X-Real-IP → platform `ip` → null.
 */
export function clientIp(req: ClientIpRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = normalizeIp(forwarded.split(",")[0]);
    if (first) return first;
  }

  const real = normalizeIp(req.headers.get("x-real-ip"));
  if (real) return real;

  return normalizeIp(req.ip ?? null);
}

/** Stable string for rate-limit keys when IP may be missing. */
export function clientIpOrUnknown(req: ClientIpRequest): string {
  return clientIp(req) ?? "unknown";
}
