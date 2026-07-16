import { NextResponse } from "next/server";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

export async function GET() {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const data = await developmentToolkitService.getHealth(actor);
    return NextResponse.json({ data, correlationId });
  });
}
