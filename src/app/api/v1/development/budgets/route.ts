import { NextResponse } from "next/server";
import { developmentToolkitService, repos } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

/** Toolkit-scoped budget list (SystemAdmin may not see operational budgets). */
export async function GET() {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    // Touch gate via health (ensures toolkit access)
    await developmentToolkitService.getHealth(actor);
    const plans = await repos.budgets.list();
    const data = plans
      .filter((p) => !p.isArchived)
      .map((p) => ({
        id: p.id,
        description: p.description,
        status: p.status,
        versionLabel: p.versionLabel,
        isDemo: p.isDemo,
        fiscalYearId: p.fiscalYearId,
      }));
    return NextResponse.json({ data, correlationId });
  });
}
