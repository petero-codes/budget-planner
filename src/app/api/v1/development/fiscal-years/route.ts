import { NextResponse } from "next/server";
import { developmentToolkitService, repos } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

export async function GET() {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    await developmentToolkitService.getHealth(actor);
    const data = await repos.fiscalYears.getAll();
    return NextResponse.json({ data, correlationId });
  });
}
