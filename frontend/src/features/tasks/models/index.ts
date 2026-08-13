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
