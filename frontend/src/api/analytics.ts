/** api/analytics.ts — dashboard aggregations (optional projectId scopes them). */
import { api } from "@/lib/apiClient";
import type {
  AnalyticsSummary,
  DelayedTaskItem,
  ProjectTimelineItem,
  StatusBreakdownItem,
} from "@/types";

function scope(projectId?: number) {
  return projectId != null ? { params: { project_id: projectId } } : undefined;
}

export async function fetchSummary(projectId?: number): Promise<AnalyticsSummary> {
  const { data } = await api.get<AnalyticsSummary>("/analytics/summary", scope(projectId));
  return data;
}

export async function fetchStatusBreakdown(projectId?: number): Promise<StatusBreakdownItem[]> {
  const { data } = await api.get<StatusBreakdownItem[]>(
    "/analytics/status-breakdown",
    scope(projectId),
  );
  return data;
}

export async function fetchProjectTimelines(projectId?: number): Promise<ProjectTimelineItem[]> {
  const { data } = await api.get<ProjectTimelineItem[]>(
    "/analytics/project-timelines",
    scope(projectId),
  );
  return data;
}

export async function fetchDelayedTasks(projectId?: number): Promise<DelayedTaskItem[]> {
  const { data } = await api.get<DelayedTaskItem[]>("/analytics/delayed-tasks", scope(projectId));
  return data;
}
