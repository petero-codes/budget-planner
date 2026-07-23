import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/same-origin";
import { clientIpOrUnknown } from "@/lib/security/client-ip";
import {
  verifySessionClaims,
  type SessionClaims,
} from "@/lib/security/session-token";
import {
  isDevelopmentToolkitEnabled,
  isDevelopmentToolkitPath,
} from "@/lib/development-toolkit-access";
import { isSessionRevoked } from "@/infrastructure/development/session-registry";

/**
 * 1. Same-origin enforcement (CORS/CSRF) on mutating requests.
 * 2. Per-IP rate limiting — general API budget, stricter budgets for
 *    workflow actions and for authentication endpoints.
 * 3. Session gate: portal pages redirect to /login when signed out.
 * 4. Coarse RBAC for sensitive portal prefixes (claims in signed cookie).
 */

const GENERAL_LIMIT = 100; // requests per window per IP for all /api routes
const GENERAL_WINDOW_MS = 60 * 1000;

const SENSITIVE_LIMIT = 10; // workflow mutations per window per IP
const SENSITIVE_WINDOW_MS = 60 * 1000;

const AUTH_LIMIT = 10; // login attempts per window per IP
const AUTH_WINDOW_MS = 5 * 60 * 1000;

// Approval + finance + amendment mutations (path segment before end)
const SENSITIVE_PATH =
  /\/(submit|approve|reject|return|claim|finalize|release|amend)$/;
const AUTH_PATH = /^\/api\/v1\/auth\/login$/;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SESSION_COOKIE = "kengen_budget_uid";

const PORTAL_PREFIXES = [
  "/home",
  "/budgets",
  "/approvals",
  "/reports",
  "/notifications",
  "/audit",
  "/profile",
  "/admin",
  "/finance",
  "/access-denied",
];

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down and try again.",
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

function hasPermission(claims: SessionClaims, code: string): boolean {
  return claims.permissionCodes.includes(code);
}

/** Path-level RBAC using permissions embedded in the signed session. */
function portalAccessAllowed(pathname: string, claims: SessionClaims): boolean {
  if (isDevelopmentToolkitPath(pathname)) {
    return (
      isDevelopmentToolkitEnabled() &&
      claims.roleCodes.includes("SystemAdmin")
    );
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
      return hasPermission(claims, "admin.users");
    }
    if (pathname === "/admin/fiscal-years" || pathname.startsWith("/admin/fiscal-years/")) {
      return (
        hasPermission(claims, "fy.manage") ||
        hasPermission(claims, "admin.masterdata") ||
        hasPermission(claims, "admin.users")
      );
    }
    return (
      hasPermission(claims, "admin.users") ||
      hasPermission(claims, "admin.masterdata")
    );
  }
  if (pathname === "/finance" || pathname.startsWith("/finance/")) {
    return hasPermission(claims, "finance.view");
  }
  if (pathname === "/audit" || pathname.startsWith("/audit/")) {
    return hasPermission(claims, "audit.view");
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return hasPermission(claims, "report.view");
  }
  return true;
}

function notFound() {
  return new NextResponse("Not Found", { status: 404 });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Development Toolkit: hard 404 unless dual-gated + SystemAdmin.
  if (isDevelopmentToolkitPath(pathname)) {
    if (!isDevelopmentToolkitEnabled()) {
      return notFound();
    }
    const raw = req.cookies.get(SESSION_COOKIE)?.value;
    const claims = raw ? await verifySessionClaims(raw) : null;
    if (!claims || isSessionRevoked(claims.userId, claims.iat)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Not Found" } },
          { status: 404 }
        );
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (!claims.roleCodes.includes("SystemAdmin")) {
      return notFound();
    }
    if (!pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    // API continues into rate-limit / same-origin checks below.
  }

  // Signed-out / forged-cookie users cannot open portal pages.
  if (PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const raw = req.cookies.get(SESSION_COOKIE)?.value;
    const claims = raw ? await verifySessionClaims(raw) : null;
    if (!claims || isSessionRevoked(claims.userId, claims.iat)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      const res = NextResponse.redirect(url);
      if (raw) {
        res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      }
      return res;
    }
    if (!portalAccessAllowed(pathname, claims)) {
      const url = req.nextUrl.clone();
      url.pathname = "/access-denied";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api")) return NextResponse.next();

  if (MUTATING_METHODS.has(req.method)) {
    const check = assertSameOrigin({
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      host: req.headers.get("host"),
    });
    if (!check.ok) {
      return NextResponse.json(
        {
          error: {
            code: check.code,
            message: check.message,
          },
        },
        { status: 403 }
      );
    }
  }

  const ip = clientIpOrUnknown(req);

  const general = rateLimit(`api:${ip}`, GENERAL_LIMIT, GENERAL_WINDOW_MS);
  if (!general.ok) {
    return tooManyRequests(general.retryAfterSeconds);
  }

  if (req.method === "POST" && AUTH_PATH.test(pathname)) {
    const auth = rateLimit(`auth:${ip}`, AUTH_LIMIT, AUTH_WINDOW_MS);
    if (!auth.ok) {
      return tooManyRequests(auth.retryAfterSeconds);
    }
  }

  if (req.method === "POST" && SENSITIVE_PATH.test(pathname)) {
    const sensitive = rateLimit(
      `workflow:${ip}`,
      SENSITIVE_LIMIT,
      SENSITIVE_WINDOW_MS
    );
    if (!sensitive.ok) {
      return tooManyRequests(sensitive.retryAfterSeconds);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/home/:path*",
    "/home",
    "/budgets/:path*",
    "/budgets",
    "/approvals/:path*",
    "/approvals",
    "/reports/:path*",
    "/reports",
    "/notifications/:path*",
    "/notifications",
    "/audit/:path*",
    "/audit",
    "/profile/:path*",
    "/profile",
    "/admin/:path*",
    "/admin",
    "/finance/:path*",
    "/finance",
    "/access-denied/:path*",
    "/access-denied",
  ],
};
