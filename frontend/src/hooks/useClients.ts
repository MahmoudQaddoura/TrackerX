/** hooks/useClients.ts — client directory, sharing, and client portal state. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignClientProjects,
  createClient,
  fetchClientPortal,
  fetchClientReportShares,
  fetchClients,
  fetchShareableClientReports,
  forwardClientReport,
  markClientReportRead,
  revokeClientReport,
  updateClient,
  type ClientCreatePayload,
  type ClientUpdatePayload,
} from "@/api/clients";

export function useClients() {
  return useQuery({ queryKey: ["clients"], queryFn: fetchClients });
}

export function useClientReportAdmin(clientId: number | null) {
  return {
    shareable: useQuery({
      queryKey: ["clients", clientId, "shareable-reports"],
      queryFn: () => fetchShareableClientReports(clientId!),
      enabled: !!clientId,
    }),
    shared: useQuery({
      queryKey: ["clients", clientId, "report-shares"],
      queryFn: () => fetchClientReportShares(clientId!),
      enabled: !!clientId,
    }),
  };
}

export function useClientMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["clients"] });
  return {
    create: useMutation({ mutationFn: (payload: ClientCreatePayload) => createClient(payload), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: ClientUpdatePayload }) => updateClient(id, payload),
      onSuccess: invalidate,
    }),
    assignProjects: useMutation({
      mutationFn: ({ id, projectIds }: { id: number; projectIds: number[] }) => assignClientProjects(id, projectIds),
      onSuccess: invalidate,
    }),
    forwardReport: useMutation({
      mutationFn: ({ clientId, reportType, reportId, message }: { clientId: number; reportType: "proactive" | "incident"; reportId: number; message?: string | null }) =>
        forwardClientReport(clientId, { report_type: reportType, report_id: reportId, message }),
      onSuccess: (_data, variables) => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["clients", variables.clientId, "shareable-reports"] });
        queryClient.invalidateQueries({ queryKey: ["clients", variables.clientId, "report-shares"] });
      },
    }),
    revokeReport: useMutation({
      mutationFn: revokeClientReport,
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      },
    }),
  };
}

export function useClientPortal() {
  return useQuery({ queryKey: ["client-portal"], queryFn: fetchClientPortal });
}

export function useMarkClientReportRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markClientReportRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-portal"] }),
  });
}
