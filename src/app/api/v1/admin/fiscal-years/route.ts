import { NextRequest, NextResponse } from "next/server";
import { fiscalYearService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { openFiscalYearSchema } from "@/lib/security/master-data-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    // fy.manage gates the full (unfiltered) list used by admin/finance.
    const fiscalYears = await fiscalYearService.listVisible(actor);
    const current = await fiscalYearService.getCurrent();
    return NextResponse.json({
      data: { fiscalYears, currentId: current?.id ?? null },
      correlationId,
    });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, openFiscalYearSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const fy = await fiscalYearService.openNew(parsed.data, actor, correlationId);
    return NextResponse.json({ data: fy, correlationId }, { status: 201 });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}
