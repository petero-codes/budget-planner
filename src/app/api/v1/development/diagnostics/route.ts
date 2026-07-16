import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("DIAGNOSE"),
  reason: z.string(),
});

export async function GET() {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    await developmentToolkitService.getHealth(actor);
    return NextResponse.json({
      data: { lastRunAt: developmentToolkitService.getLastDiagnosticsAt() },
      correlationId,
    });
  });
}

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.runDiagnostics(
      actor,
      body.confirm,
      body.reason,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}
