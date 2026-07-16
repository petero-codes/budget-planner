import { NextRequest, NextResponse } from "next/server";
import {
  consumeToken,
  markEmailVerified,
} from "@/infrastructure/auth/auth-store";
import { hashToken } from "@/lib/security/passwords";
import { verifyEmailSchema } from "@/lib/security/auth-schemas";
import { parseBody } from "@/lib/security/api-schemas";
import { safeInternalMessage } from "@/lib/security/safe-error-message";

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const parsed = await parseBody(req, verifyEmailSchema, correlationId);
    if (!parsed.ok) return parsed.response;

    const consumed = await consumeToken({
      type: "verify-email",
      tokenHash: hashToken(parsed.data.token),
    });
    if (!consumed) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message:
              "This verification link is invalid or has expired. Register again or request a new link.",
            correlationId,
          },
        },
        { status: 400 }
      );
    }

    await markEmailVerified(consumed.userId);
    return NextResponse.json({
      data: { message: "Email verified. You can now sign in." },
      correlationId,
    });
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
