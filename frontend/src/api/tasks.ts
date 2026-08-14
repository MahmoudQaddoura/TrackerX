/** api/tasks.ts — task CRUD. */
import { api } from "@/lib/apiClient";
import type { Task } from "@/types";

export interface TaskPayload {
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  is_delayed?: boolean;
  delay_cause?: string | null;
  delay_comment?: string | null;
  est_days?: number | null;
  assigned_member_ids?: number[];
  assigned_member_id?: number | null;
  sort_order?: number;
}

export async function fetchTasks(milestoneId: number): Promise<Task[]> {
  const { data } = await api.get<Task[]>(`/milestones/${milestoneId}/tasks`);
  return data;
}

/** Flattened tasks across every milestone in a project — feeds the Kanban board. */
export async function fetchProjectTasks(projectId: number): Promise<Task[]> {
  const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`);
  return data;
}

/** Kanban drag-and-drop: status only (open to developer, with server-side rules). */
export async function updateTaskStatus(id: number, status: string): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}/status`, { status });
  return data;
}

export async function createTask(milestoneId: number, payload: TaskPayload): Promise<Task> {
  const { data } = await api.post<Task>(`/milestones/${milestoneId}/tasks`, payload);
  return data;
}

export async function updateTask(id: number, payload: TaskPayload): Promise<Task> {
  const { data } = await api.put<Task>(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id: number): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
