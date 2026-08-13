import apiClient from "@/shared/api/apiClient";
import {
  Task,
  DashboardTask,
  DashboardData,
  CreateTaskDTO,
  UpdateTaskDTO,
} from "../models";

function normalizeDate(s: string): string {
  return s ? s.substring(0, 10) : s;
}

function normalizeTask<T extends Task>(t: T): T {
  return { ...t, due_date: normalizeDate(t.due_date) };
}

function normalizeDashboard(d: DashboardData): DashboardData {
  return {
    overdue: d.overdue.map(normalizeTask<DashboardTask>),
    today: d.today.map(normalizeTask<DashboardTask>),
    completed_today: d.completed_today.map(normalizeTask<DashboardTask>),
  };
}

export async function apiGetDashboard(
  today: string,
  signal?: AbortSignal
): Promise<DashboardData> {
  const res = await apiClient.get<DashboardData>("/tasks/dashboard", {
    params: { today },
    signal,
  });
  return normalizeDashboard(res.data);
}

export async function apiGetAllTasks(signal?: AbortSignal): Promise<Task[]> {
  const res = await apiClient.get<Task[]>("/tasks", { signal });
  return res.data.map(normalizeTask);
}

export async function apiGetUpcoming(
  today: string,
  signal?: AbortSignal
): Promise<Task[]> {
  const res = await apiClient.get<Task[]>("/tasks/upcoming", {
    params: { today },
    signal,
  });
  return res.data.map(normalizeTask);
}

export async function apiGetArchive(signal?: AbortSignal): Promise<Task[]> {
  const res = await apiClient.get<Task[]>("/tasks/archive", { signal });
  return res.data.map(normalizeTask);
}

export async function apiCreateTask(
  data: CreateTaskDTO,
  signal?: AbortSignal
): Promise<Task> {
  const res = await apiClient.post<Task>("/tasks", data, { signal });
  return res.data;
}

export async function apiUpdateTask(
  id: string,
  data: UpdateTaskDTO,
  signal?: AbortSignal
): Promise<Task> {
  const res = await apiClient.put<Task>(`/tasks/${id}`, data, { signal });
  return res.data;
}

export async function apiDeleteTask(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  await apiClient.delete(`/tasks/${id}`, { signal });
}

export async function apiRestoreTask(
  id: string,
  signal?: AbortSignal
): Promise<Task> {
  const res = await apiClient.put<Task>(`/tasks/${id}/restore`, {}, { signal });
  return res.data;
}
