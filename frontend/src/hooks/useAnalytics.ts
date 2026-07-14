/** hooks/useAnalytics.ts — dashboard analytics + gantt queries (optional project scope). */
import { useQuery } from "@tanstack/react-query";

import {
  fetchDelayedTasks,
  fetchProjectTimelines,
  fetchStatusBreakdown,
  fetchSummary,
} from "@/api/analytics";
import { fetchGantt } from "@/api/gantt";

const key = (name: string, projectId?: number) => ["analytics", name, projectId ?? "all"];

export function useSummary(projectId?: number) {
  return useQuery({ queryKey: key("summary", projectId), queryFn: () => fetchSummary(projectId) });
}

export function useStatusBreakdown(projectId?: number) {
  return useQuery({
    queryKey: key("status", projectId),
    queryFn: () => fetchStatusBreakdown(projectId),
  });
}

export function useProjectTimelines(projectId?: number) {
  return useQuery({
    queryKey: key("timelines", projectId),
    queryFn: () => fetchProjectTimelines(projectId),
  });
}

export function useDelayedTasks(projectId?: number) {
  return useQuery({
    queryKey: key("delayed", projectId),
    queryFn: () => fetchDelayedTasks(projectId),
  });
}

export function useGantt(projectId: number) {
  return useQuery({
    queryKey: ["gantt", projectId],
    queryFn: () => fetchGantt(projectId),
    enabled: !!projectId,
  });
}
