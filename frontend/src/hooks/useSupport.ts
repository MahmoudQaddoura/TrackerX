/** hooks/useSupport.ts — Maintenance & Support dashboard queries and mutations. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProactiveReport,
  createSupportIncident,
  deleteProactiveReport,
  deleteSupportIncident,
  fetchProactiveReports,
  fetchSupportIncidents,
  updateProactiveReport,
  updateSupportIncident,
  type ProactiveReportPayload,
  type SupportIncidentPayload,
} from "@/api/support";

export function useProactiveReports(projectId: number) {
  return useQuery({
    queryKey: ["support", projectId, "proactive"],
    queryFn: () => fetchProactiveReports(projectId),
  });
}

export function useSupportIncidents(projectId: number) {
  return useQuery({
    queryKey: ["support", projectId, "incidents"],
    queryFn: () => fetchSupportIncidents(projectId),
  });
}

export function useSupportMutations(projectId: number) {
  const queryClient = useQueryClient();
  const invalidateProactive = () =>
    queryClient.invalidateQueries({ queryKey: ["support", projectId, "proactive"] });
  const invalidateIncidents = () =>
    queryClient.invalidateQueries({ queryKey: ["support", projectId, "incidents"] });

  return {
    createReport: useMutation({
      mutationFn: (payload: ProactiveReportPayload) => createProactiveReport(projectId, payload),
      onSuccess: invalidateProactive,
    }),
    updateReport: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: ProactiveReportPayload }) =>
        updateProactiveReport(id, payload),
      onSuccess: invalidateProactive,
    }),
    deleteReport: useMutation({ mutationFn: deleteProactiveReport, onSuccess: invalidateProactive }),
    createIncident: useMutation({
      mutationFn: (payload: SupportIncidentPayload) => createSupportIncident(projectId, payload),
      onSuccess: invalidateIncidents,
    }),
    updateIncident: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: SupportIncidentPayload }) =>
        updateSupportIncident(id, payload),
      onSuccess: invalidateIncidents,
    }),
    deleteIncident: useMutation({ mutationFn: deleteSupportIncident, onSuccess: invalidateIncidents }),
  };
}
