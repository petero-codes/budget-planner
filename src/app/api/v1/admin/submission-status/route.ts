import { NextRequest, NextResponse } from "next/server";
import {
  fiscalYearService,
  getCurrentUser,
  submissionStatusService,
} from "@/infrastructure/di";
import { adminApiError } from "@/lib/security/admin-api-error";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const requested = request.nextUrl.searchParams.get("fiscalYearId");
    const fiscalYearId =
      requested ?? (await fiscalYearService.getCurrent())?.id ?? null;
    if (!fiscalYearId) {
      return NextResponse.json({
        data: { fiscalYearId: null, statuses: [] },
        correlationId,
      });
    }
    const statuses = await submissionStatusService.listForFiscalYear(
      actor,
      fiscalYearId
    );
    return NextResponse.json({
      data: { fiscalYearId, statuses },
      correlationId,
    });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}
