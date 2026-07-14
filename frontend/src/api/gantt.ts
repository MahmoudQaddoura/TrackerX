/** api/gantt.ts — frappe-gantt task rows for a project. */
import { api } from "@/lib/apiClient";
import type { GanttTaskDTO } from "@/types";

export async function fetchGantt(projectId: number): Promise<GanttTaskDTO[]> {
  const { data } = await api.get<GanttTaskDTO[]>(`/projects/${projectId}/gantt`);
  return data;
}
