import { NextRequest, NextResponse } from "next/server";
import { adminUserService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { resetAdminPasswordSchema } from "@/lib/security/admin-user-schemas";
import {
  checkPasswordPolicy,
  hashPassword,
} from "@/lib/security/passwords";
import { adminApiError } from "@/lib/security/admin-api-error";

type Context = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(
      request,
      resetAdminPasswordSchema,
      correlationId
    );
    if (!parsed.ok) return parsed.response;

    const password = parsed.data.password;
    const issues = checkPasswordPolicy(password);
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: issues.map((issue) => issue.message).join("; "),
            correlationId,
          },
        },
        { status: 422 }
      );
    }

    await adminUserService.resetPassword(
      params.id,
      hashPassword(password),
      actor,
      correlationId
    );

    return NextResponse.json({
      data: { reset: true },
      correlationId,
    });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}
