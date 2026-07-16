import { NextRequest, NextResponse } from "next/server";
import { FiscalYearServiceError } from "@/application/fiscal-year-service";
import { fiscalYearService, getCurrentUser } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

type Action = "close" | "reopen" | "archive";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  const correlationId = crypto.randomUUID();
  const action = params.action as Action;
  try {
    const user = await getCurrentUser();
    let fy;
    if (action === "close") {
      fy = await fiscalYearService.close(params.id, user, correlationId);
    } else if (action === "reopen") {
      fy = await fiscalYearService.reopen(params.id, user, correlationId);
    } else if (action === "archive") {
      fy = await fiscalYearService.archive(params.id, user, correlationId);
    } else {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "action must be close, reopen, or archive",
            correlationId,
          },
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ data: fy, correlationId });
  } catch (e) {
    if (e instanceof FiscalYearServiceError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, correlationId } },
        { status: 422 }
      );
    }
    return readApiError(e, correlationId);
  }
}
