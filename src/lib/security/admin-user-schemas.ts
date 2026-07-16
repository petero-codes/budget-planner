import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(256)
  .refine((value) => value.endsWith("@kengen.co.ke"), {
    message: "Use a KenGen email address (@kengen.co.ke)",
  });

export const adminUserSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email,
  positionId: z.string().uuid(),
  managerId: z.string().uuid().nullable(),
  departmentId: z.string().uuid(),
  primaryCostCenterId: z.string().uuid(),
  roleCodes: z.array(z.string().trim().min(1).max(50)).min(1),
  active: z.boolean(),
});

export const createAdminUserSchema = adminUserSchema.extend({
  temporaryPassword: z.string().min(8).max(200),
});

export const resetAdminPasswordSchema = z.object({
  /** Permanent password set by the administrator for the target user. */
  password: z.string().min(8).max(200),
});
