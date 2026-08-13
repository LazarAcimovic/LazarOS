import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be YYYY-MM-DD"),
  priority: z.enum(["low", "medium", "high"]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be YYYY-MM-DD")
    .optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "completed"]).optional(),
});
