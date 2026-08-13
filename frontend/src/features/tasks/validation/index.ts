import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).optional(),
  due_date: z
    .string()
    .min(1, "Due date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  priority: z.enum(["low", "medium", "high"]),
});

export const editTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).optional(),
  due_date: z
    .string()
    .min(1, "Due date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "completed"]),
});

export type CreateTaskValues = z.infer<typeof createTaskSchema>;
export type EditTaskValues = z.infer<typeof editTaskSchema>;
