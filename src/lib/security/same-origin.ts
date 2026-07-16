/**
 * Same-origin guard for mutating requests (CSRF mitigation).
 * Accepts Origin, else Referer; rejects when neither is present or host mismatches.
 */

export type SameOriginResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN_ORIGIN" | "MISSING_ORIGIN"; message: string };

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function assertSameOrigin(headers: {
  origin: string | null;
  referer: string | null;
  host: string | null;
}): SameOriginResult {
  const host = headers.host?.trim() ?? "";
  if (!host) {
    return {
      ok: false,
      code: "MISSING_ORIGIN",
      message: "Host header is required for mutating requests.",
    };
  }

  const origin = headers.origin?.trim() || null;
  if (origin) {
    const originHost = hostFromUrl(origin);
    if (!originHost || originHost !== host) {
      return {
        ok: false,
        code: "FORBIDDEN_ORIGIN",
        message: "Cross-origin requests are not allowed.",
      };
    }
    return { ok: true };
  }

  const referer = headers.referer?.trim() || null;
  if (referer) {
    const refererHost = hostFromUrl(referer);
    if (!refererHost || refererHost !== host) {
      return {
        ok: false,
        code: "FORBIDDEN_ORIGIN",
        message: "Cross-origin requests are not allowed.",
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    code: "MISSING_ORIGIN",
    message:
      "Mutating requests require an Origin or Referer header from this site.",
  };
}
