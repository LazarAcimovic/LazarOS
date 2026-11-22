import type { Task, DashboardTask } from "./models";

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "1",
    user_id: "u1",
    title: "Test task",
    description: null,
    due_date: "2026-12-01",
    priority: "medium",
    status: "pending",
    is_deleted: false,
    completed_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

export function makeDashboardTask(
  section: DashboardTask["section"],
  overrides: Partial<DashboardTask> = {}
): DashboardTask {
  return {
    ...makeTask(),
    section,
    days_overdue: 0,
    ...overrides,
  };
}

/** Local calendar date `offsetDays` from today, as YYYY-MM-DD. */
export function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
