/** api/milestones.ts — milestone CRUD. */
import { api } from "@/lib/apiClient";
import type { Milestone } from "@/types";

export interface MilestonePayload {
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_order?: number;
}

export async function fetchMilestones(projectId: number): Promise<Milestone[]> {
  const { data } = await api.get<Milestone[]>(`/projects/${projectId}/milestones`);
  return data;
}

export async function createMilestone(
  projectId: number,
  payload: MilestonePayload,
): Promise<Milestone> {
  const { data } = await api.post<Milestone>(`/projects/${projectId}/milestones`, payload);
  return data;
}

export async function updateMilestone(id: number, payload: MilestonePayload): Promise<Milestone> {
  const { data } = await api.put<Milestone>(`/milestones/${id}`, payload);
  return data;
}

export async function deleteMilestone(id: number): Promise<void> {
  await api.delete(`/milestones/${id}`);
}
