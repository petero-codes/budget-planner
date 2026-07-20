import "client-only";

/** Browser-side API helpers — fetch only; never SQL/DI/application. */

import type { ExistingActiveBudget } from "@/domain/existing-active-budget";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public existingBudget?: ExistingActiveBudget
  ) {
    super(message);
  }
}

const inFlightGets = new Map<string, Promise<unknown>>();
const recentGets = new Map<string, { value: unknown; expiresAt: number }>();
const GET_DEDUPE_TTL_MS = 750;

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as {
    data?: T;
    error?: {
      message?: string;
      code?: string;
      existingBudget?: ExistingActiveBudget;
    };
  };
  if (!res.ok) {
    throw new ApiError(
      json.error?.message ?? `Request failed (${res.status})`,
      res.status,
      json.error?.code,
      json.error?.existingBudget
    );
  }
  return json.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const recent = recentGets.get(path);
  if (recent && recent.expiresAt > Date.now()) {
    return recent.value as T;
  }

  const existing = inFlightGets.get(path);
  if (existing) return existing as Promise<T>;

  const request = fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((res) => parse<T>(res))
    .then((value) => {
      recentGets.set(path, {
        value,
        expiresAt: Date.now() + GET_DEDUPE_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      inFlightGets.delete(path);
    });

  inFlightGets.set(path, request);
  return request;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  recentGets.clear();
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const value = await parse<T>(res);
  recentGets.clear();
  return value;
}
