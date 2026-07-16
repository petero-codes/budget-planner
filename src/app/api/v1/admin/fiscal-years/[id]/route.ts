import { NextRequest, NextResponse } from "next/server";
import { fiscalYearService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { fiscalYearActionSchema } from "@/lib/security/master-data-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, fiscalYearActionSchema, correlationId);
    if (!parsed.ok) return parsed.response;

    const { action } = parsed.data;
    const fy =
      action === "close"
        ? await fiscalYearService.close(params.id, actor, correlationId)
        : action === "reopen"
          ? await fiscalYearService.reopen(params.id, actor, correlationId)
          : action === "archive"
            ? await fiscalYearService.archive(params.id, actor, correlationId)
            : await fiscalYearService.setCurrent(params.id, actor, correlationId);

    return NextResponse.json({ data: fy, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}
