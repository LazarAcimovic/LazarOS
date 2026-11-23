import { z } from "zod";

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

const passwordSchema = z
  .string()
  .min(8, { message: "Password must be minimum 8 characters long" })
  .max(20, { message: "Password must be maximum 20 characters long" })
  .refine((v) => /[A-Z]/.test(v), { message: "At least one uppercase letter required" })
  .refine((v) => /[a-z]/.test(v), { message: "At least one lowercase letter required" })
  .refine((v) => /[0-9]/.test(v), { message: "At least one number required" })
  .refine((v) => /[^A-Za-z0-9]/.test(v), { message: "At least one special character required" });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
