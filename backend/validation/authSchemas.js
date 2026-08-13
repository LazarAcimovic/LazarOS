import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, { message: "Password must be minimum 8 characters long" })
  .max(20, { message: "Password must be maximum 20 characters long" })
  .refine((v) => /[A-Z]/.test(v), { message: "At least one uppercase letter required" })
  .refine((v) => /[a-z]/.test(v), { message: "At least one lowercase letter required" })
  .refine((v) => /[0-9]/.test(v), { message: "At least one number required" })
  .refine((v) => /[^A-Za-z0-9]/.test(v), { message: "At least one special character required" });

export const registerSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
