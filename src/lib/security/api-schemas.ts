import "server-only";

import { z } from "zod";
import { NextResponse } from "next/server";
import {
  BUDGET_CATEGORY_CODES,
  budgetCategoryLabel,
  isBudgetCategory,
} from "@/domain/constants/budget-types";

/** Shared zod schemas for API request bodies (never trust the client). */

const period = z
  .string()
  .trim()
  .min(1, "Period is required")
  .max(20, "Period is too long");

export const createDraftSchema = z.object({
  budgetCategory: z.enum(BUDGET_CATEGORY_CODES, {
    errorMap: () => ({
      message: `Category must be one of: ${BUDGET_CATEGORY_CODES.map(budgetCategoryLabel).join(", ")}`,
    }),
  }),
  fiscalYearId: z.string().trim().min(1, "Fiscal year is required").max(64),
  fromPeriod: period,
  toPeriod: period,
  costCenterId: z.string().trim().min(1, "Cost center is required").max(64),
  description: z
    .string()
    .trim()
    .max(1000, "Description is too long")
    .optional()
    .nullable(),
  lines: z
    .array(
      z.object({
        glAccountId: z.string().trim().min(1).max(64),
        amount: z
          .number()
          .finite()
          .int("Amount must be a whole number")
          .positive("Amount must be greater than zero"),
      })
    )
    .min(1, "At least one budget line is required")
    .max(500, "Too many budget lines"),
});

export const rejectSchema = z
  .object({
    reason: z.string().trim().max(2000).optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((v) => (v.reason ?? v.comment ?? "").length > 0, {
    message: "Rejection reason is required",
  });

export const returnSchema = z
  .object({
    reason: z.string().trim().max(2000).optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((v) => (v.reason ?? v.comment ?? "").length > 0, {
    message: "A reason is required to return for revision",
  });

export const approveSchema = z.object({
  comment: z.string().trim().max(2000).optional().nullable(),
});

/**
 * Parse a JSON body against a schema. Returns the parsed data, or a 422
 * NextResponse if the body is malformed or fails validation.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  correlationId: string
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "Request body must be valid JSON",
            correlationId,
          },
        },
        { status: 422 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: result.error.issues
              .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
              .join("; "),
            correlationId,
          },
        },
        { status: 422 }
      ),
    };
  }
  return { ok: true, data: result.data };
}
