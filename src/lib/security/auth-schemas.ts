import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(256)
    .refine((e) => e.endsWith("@kengen.co.ke"), {
      message: "Use your KenGen email (@kengen.co.ke)",
    }),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  costCenterId: z.string().trim().min(1, "Select your cost center").max(64),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(256),
  // Trim accidental paste spaces; keep internal spaces if any.
  password: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Enter your password").max(200)),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(256),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(10).max(200),
});
