import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import {
  authorizationService,
  budgetPlanService,
  getCurrentUser,
  repos,
} from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    if (!user.permissionCodes.includes("report.view")) {
      throw new AuthorizationError("Missing permission: report.view");
    }
    const showHistorical =
      req.nextUrl.searchParams.get("historical") === "true";

    const plans = showHistorical
      ? await budgetPlanService.listVisible(user)
      : await authorizationService.filterVisiblePlans(
          user,
          await repos.budgets.listLatestFinalizedVersions()
        );

    return NextResponse.json({
      data: plans,
      defaultFilter: showHistorical ? "historical" : "latestFinalized",
      correlationId,
    });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
