import { z } from "zod";

const emailSchema = z.string().trim().email("Invalid email address").max(320);

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(120).optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20, "Invalid refresh token"),
});

export const oauthExchangeBodySchema = z.object({
  code: z.string().min(10, "Invalid code"),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
