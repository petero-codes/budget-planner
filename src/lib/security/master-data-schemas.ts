import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(1).max(50),
  isActive: z.boolean(),
});

const uuidOrNull = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const costCenterSchema = z.object({
  code: z.string().trim().min(1).max(50),
  sapCostCenterCode: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  name: z.string().trim().min(2).max(200),
  departmentId: z.string().uuid(),
  managerId: uuidOrNull,
  responsiblePersonId: uuidOrNull,
  isActive: z.boolean(),
});

export const openFiscalYearSchema = z.object({
  yearLabel: z.number().int().min(2000).max(2100),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10),
});

export const fiscalYearActionSchema = z.object({
  action: z.enum(["close", "reopen", "archive", "setCurrent"]),
});
