/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single-instance deployment (dev / demo / one Node server).
 * When the app scales to multiple instances, swap the store for Redis
 * (e.g. @upstash/ratelimit) without changing call sites.
 */

import "server-only";


interface WindowEntry {
  /** Timestamps (ms) of requests inside the current window. */
  hits: number[];
}

const store = new Map<string, WindowEntry>();

/** Periodically drop stale keys so the map cannot grow unbounded. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  store.forEach((entry, key) => {
    entry.hits = entry.hits.filter((t) => now - t < windowMs);
    if (entry.hits.length === 0) store.delete(key);
  });
}

export interface RateLimitResult {
  ok: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Seconds until the oldest hit leaves the window (for Retry-After). */
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const entry = store.get(key) ?? { hits: [] };
  entry.hits = entry.hits.filter((t) => now - t < windowMs);

  if (entry.hits.length >= limit) {
    const oldest = entry.hits[0];
    store.set(key, entry);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  entry.hits.push(now);
  store.set(key, entry);
  return {
    ok: true,
    remaining: limit - entry.hits.length,
    retryAfterSeconds: 0,
  };
}
