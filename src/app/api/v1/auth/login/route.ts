import { NextRequest, NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/infrastructure/auth/auth-store";
import { verifyPassword } from "@/lib/security/passwords";
import { loginSchema } from "@/lib/security/auth-schemas";
import { parseBody } from "@/lib/security/api-schemas";
import { SESSION_COOKIE, setMemoryUserId } from "@/infrastructure/session";
import {
  createSessionToken,
  SESSION_TTL_SECONDS,
  verifySessionClaims,
} from "@/lib/security/session-token";
import { safeInternalMessage } from "@/lib/security/safe-error-message";
import { isDevelopmentToolkitEnabled } from "@/lib/development-toolkit-access";
import { registerDevSession } from "@/infrastructure/development/session-registry";

/**
 * POST /api/v1/auth/login — WF-016
 * Validates credentials, sets signed session cookie. No budget mutations.
 */
export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const parsed = await parseBody(req, loginSchema, correlationId);
    if (!parsed.ok) return parsed.response;

    const record = await findAuthUserByEmail(parsed.data.email);
    // Same error for unknown email / wrong password — no account enumeration.
    const invalid = NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
          correlationId,
        },
      },
      { status: 401 }
    );
    if (!record || !record.user.active) return invalid;
    if (!record.passwordHash) {
      return NextResponse.json(
        {
          error: {
            code: "PASSWORD_NOT_SET",
            message:
              "This account has no password. Contact the System Administrator.",
            correlationId,
          },
        },
        { status: 403 }
      );
    }
    if (!verifyPassword(parsed.data.password, record.passwordHash)) {
      return invalid;
    }
    if (!record.emailVerifiedAt) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_UNVERIFIED",
            message:
              "This account is not activated. Contact the System Administrator.",
            correlationId,
          },
        },
        { status: 403 }
      );
    }

    setMemoryUserId(record.user.id);
    const sessionToken = await createSessionToken(record.user.id, {
      roleCodes: record.user.roleCodes,
      permissionCodes: record.user.permissionCodes,
    });
    if (isDevelopmentToolkitEnabled()) {
      const claims = await verifySessionClaims(sessionToken);
      if (claims) {
        registerDevSession({
          sessionId: crypto.randomUUID(),
          userId: claims.userId,
          userAgent: req.headers.get("user-agent") ?? "",
          iat: claims.iat,
        });
      }
    }
    const res = NextResponse.json({
      data: {
        userId: record.user.id,
        isAdmin: record.user.roleCodes.includes("SystemAdmin"),
        isFinance: record.user.roleCodes.includes("FinanceAdministrator"),
        redirectTo: record.user.roleCodes.includes("SystemAdmin")
          ? "/admin"
          : record.user.roleCodes.includes("FinanceAdministrator")
            ? "/finance"
            : "/home",
      },
      correlationId,
    });
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: safeInternalMessage(e),
          correlationId,
        },
      },
      { status: 500 }
    );
  }
}
