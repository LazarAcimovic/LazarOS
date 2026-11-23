import { z } from "zod";

export type Priority = "low" | "medium" | "high";
export type Status = "pending" | "completed";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: Priority;
  status: Status;
  is_deleted: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardTask extends Task {
  section: "overdue" | "today" | "completed_today";
  days_overdue: number;
}

export interface DashboardData {
  overdue: DashboardTask[];
  today: DashboardTask[];
  completed_today: DashboardTask[];
}

export interface CreateTaskDTO {
  title: string;
  description?: string | null;
  due_date: string;
  priority: Priority;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string | null;
  due_date?: string;
  priority?: Priority;
  status?: Status;
}

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
