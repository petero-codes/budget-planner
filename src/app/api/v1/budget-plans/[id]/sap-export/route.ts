import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import {
  budgetPlanService,
  getCurrentUser,
  repos,
} from "@/infrastructure/di";
import { buildSapCsv } from "@/infrastructure/export/sap-csv-writer";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    if (!user.permissionCodes.includes("report.export")) {
      throw new AuthorizationError("Missing permission: report.export");
    }
    const plan = await budgetPlanService.getById(params.id, user);
    if (plan.status !== "Approved") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "Only Approved budgets can be exported",
            correlationId,
          },
        },
        { status: 422 }
      );
    }
    const cc = await repos.costCenters.getById(plan.costCenterId);
    const fy = await repos.fiscalYears.getById(plan.fiscalYearId);
    if (!cc || !fy) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Cost center or fiscal year missing",
            correlationId,
          },
        },
        { status: 404 }
      );
    }
    const gls = await repos.glAccounts.getAll();
    const glMap = new Map(gls.map((g) => [g.id, g]));
    const csv = buildSapCsv(plan, cc, glMap, fy.yearLabel);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sap-budget-${cc.code}-${fy.yearLabel}.csv"`,
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
