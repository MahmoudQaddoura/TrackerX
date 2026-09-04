/** api/clients.ts — admin client management and the client-facing portal. */
import { api } from "@/lib/apiClient";
import type {
  ClientPortal,
  ClientProfile,
  ClientReportShare,
  ShareableClientReport,
} from "@/types";

export interface ClientCreatePayload {
  email: string;
  full_name: string;
  temporary_password: string;
  organization?: string | null;
  job_title?: string | null;
  phone?: string | null;
  notes?: string | null;
  project_ids: number[];
}

export interface ClientUpdatePayload {
  email?: string;
  full_name?: string;
  temporary_password?: string | null;
  organization?: string | null;
  job_title?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_enabled?: boolean;
}

export async function fetchClients(): Promise<ClientProfile[]> {
  const { data } = await api.get<ClientProfile[]>("/clients");
  return data;
}

export async function createClient(payload: ClientCreatePayload): Promise<ClientProfile> {
  const { data } = await api.post<ClientProfile>("/clients", payload);
  return data;
}

export async function updateClient(id: number, payload: ClientUpdatePayload): Promise<ClientProfile> {
  const { data } = await api.put<ClientProfile>(`/clients/${id}`, payload);
  return data;
}

export async function assignClientProjects(id: number, projectIds: number[]): Promise<ClientProfile> {
  const { data } = await api.put<ClientProfile>(`/clients/${id}/projects`, {
    project_ids: projectIds,
  });
  return data;
}

export async function fetchShareableClientReports(id: number): Promise<ShareableClientReport[]> {
  const { data } = await api.get<ShareableClientReport[]>(`/clients/${id}/shareable-reports`);
  return data;
}

export async function fetchClientReportShares(id: number): Promise<ClientReportShare[]> {
  const { data } = await api.get<ClientReportShare[]>(`/clients/${id}/report-shares`);
  return data;
}

export async function forwardClientReport(
  clientId: number,
  payload: { report_type: "proactive" | "incident"; report_id: number; message?: string | null },
): Promise<ClientReportShare> {
  const { data } = await api.post<ClientReportShare>(`/clients/${clientId}/report-shares`, payload);
  return data;
}

export async function revokeClientReport(shareId: number): Promise<void> {
  await api.delete(`/client-report-shares/${shareId}`);
}

export async function fetchClientPortal(): Promise<ClientPortal> {
  const { data } = await api.get<ClientPortal>("/client/portal");
  return data;
}

export async function markClientReportRead(shareId: number): Promise<ClientReportShare> {
  const { data } = await api.patch<ClientReportShare>(`/client/reports/${shareId}/read`);
  return data;
}

export async function exportForwardedReportPdf(shareId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/client/reports/${shareId}/export/pdf`, {
    responseType: "blob",
  });
  return data;
}
