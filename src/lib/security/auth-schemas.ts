import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(256),
  // Trim accidental paste spaces; keep internal spaces if any.
  password: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Enter your password").max(200)),
});
