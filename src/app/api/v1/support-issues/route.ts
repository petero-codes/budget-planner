import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentUser,
  supportIssueService,
} from "@/infrastructure/di";
import {
  SUPPORT_ISSUE_CATEGORIES,
  SUPPORT_ISSUE_PRIORITIES,
} from "@/domain/support-issue";
import { SupportIssueServiceError } from "@/application/support-issue-service";
import { readApiError } from "@/lib/security/read-api-error";

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(4000),
  category: z.enum(SUPPORT_ISSUE_CATEGORIES),
  priority: z.enum(SUPPORT_ISSUE_PRIORITIES),
  pagePath: z.string().max(500).nullable().optional(),
  pageLabel: z.string().max(200).nullable().optional(),
  budgetPlanId: z.string().nullable().optional(),
  fiscalYearId: z.string().nullable().optional(),
  costCenterId: z.string().nullable().optional(),
  browser: z.string().max(200).nullable().optional(),
  appVersion: z.string().max(40).nullable().optional(),
  correlationId: z.string().max(64).nullable().optional(),
  screenshot: z
    .object({
      fileName: z.string().min(1).max(260),
      contentType: z.string().min(1).max(120),
      contentBase64: z.string().min(1),
    })
    .nullable()
    .optional(),
});

function errorResponse(e: unknown, correlationId: string) {
  if (e instanceof SupportIssueServiceError) {
    const status =
      e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { error: { code: e.code, message: e.message, correlationId } },
      { status }
    );
  }
  return readApiError(e, correlationId);
}

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const scope = req.nextUrl.searchParams.get("scope");
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const data =
      scope === "all" && user.roleCodes.includes("SystemAdmin")
        ? await supportIssueService.listAll(user, { status })
        : await supportIssueService.listMine(user);
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return errorResponse(e, correlationId);
  }
}

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const body = createSchema.parse(await req.json());
    const data = await supportIssueService.create(user, body, correlationId);
    return NextResponse.json({ data, correlationId }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: e.errors[0]?.message ?? "Invalid input",
            correlationId,
          },
        },
        { status: 400 }
      );
    }
    return errorResponse(e, correlationId);
  }
}
