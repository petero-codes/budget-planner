import { NextRequest, NextResponse } from "next/server";
import { adminUserService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { createAdminUserSchema } from "@/lib/security/admin-user-schemas";
import {
  checkPasswordPolicy,
  hashPassword,
} from "@/lib/security/passwords";
import { adminApiError } from "@/lib/security/admin-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const data = await adminUserService.list(actor);
    return NextResponse.json({ data, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(
      request,
      createAdminUserSchema,
      correlationId
    );
    if (!parsed.ok) return parsed.response;
    const issues = checkPasswordPolicy(parsed.data.temporaryPassword);
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
    const { temporaryPassword, ...input } = parsed.data;
    const user = await adminUserService.create(
      input,
      hashPassword(temporaryPassword),
      actor,
      correlationId
    );
    return NextResponse.json({ data: user, correlationId }, { status: 201 });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}
