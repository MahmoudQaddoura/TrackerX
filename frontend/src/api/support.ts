/** api/support.ts — structured service reports and incident workflows. */
import { api } from "@/lib/apiClient";
import type {
  ProactiveReportCategory,
  ProactiveReportStatus,
  ProactiveServiceReport,
  SupportIncident,
  SupportIncidentSeverity,
  SupportIncidentStatus,
} from "@/types";

export interface ProactiveReportPayload {
  category?: ProactiveReportCategory;
  service_area_name?: string | null;
  title?: string;
  status?: ProactiveReportStatus;
  period_start?: string | null;
  period_end?: string | null;
  due_date?: string | null;
  executive_summary?: string | null;
  findings?: string | null;
  work_completed?: string | null;
  recommendations?: string | null;
  next_action_date?: string | null;
  assigned_member_ids?: number[];
}

export interface SupportIncidentPayload {
  title?: string;
  detection_source?: "client" | "team" | "monitoring" | "third_party";
  reported_by_name?: string | null;
  affected_service?: string | null;
  client_report?: string | null;
  reason?: string | null;
  description?: string | null;
  reported_at?: string;
  severity?: SupportIncidentSeverity;
  recommendation?: string | null;
  containment_actions?: string | null;
  investigation?: string | null;
  root_cause?: string | null;
  response_at?: string | null;
  response_description?: string | null;
  recovery_validation?: string | null;
  status?: SupportIncidentStatus;
  resolution_notes?: string | null;
  lessons_learned?: string | null;
  assigned_member_ids?: number[];
}

export async function fetchProactiveReports(projectId: number): Promise<ProactiveServiceReport[]> {
  const { data } = await api.get<ProactiveServiceReport[]>(
    `/projects/${projectId}/support/proactive`,
  );
  return data;
}

export async function createProactiveReport(
  projectId: number,
  payload: ProactiveReportPayload,
): Promise<ProactiveServiceReport> {
  const { data } = await api.post<ProactiveServiceReport>(
    `/projects/${projectId}/support/proactive`,
    payload,
  );
  return data;
}

export async function updateProactiveReport(
  reportId: number,
  payload: ProactiveReportPayload,
): Promise<ProactiveServiceReport> {
  const { data } = await api.put<ProactiveServiceReport>(
    `/support/proactive/${reportId}`,
    payload,
  );
  return data;
}

export async function deleteProactiveReport(reportId: number): Promise<void> {
  await api.delete(`/support/proactive/${reportId}`);
}

export async function exportProactiveReportPdf(reportId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/support/proactive/${reportId}/export/pdf`, {
    responseType: "blob",
  });
  return data;
}

export async function fetchSupportIncidents(projectId: number): Promise<SupportIncident[]> {
  const { data } = await api.get<SupportIncident[]>(
    `/projects/${projectId}/support/incidents`,
  );
  return data;
}

export async function createSupportIncident(
  projectId: number,
  payload: SupportIncidentPayload,
): Promise<SupportIncident> {
  const { data } = await api.post<SupportIncident>(
    `/projects/${projectId}/support/incidents`,
    payload,
  );
  return data;
}

export async function updateSupportIncident(
  incidentId: number,
  payload: SupportIncidentPayload,
): Promise<SupportIncident> {
  const { data } = await api.put<SupportIncident>(
    `/support/incidents/${incidentId}`,
    payload,
  );
  return data;
}

export async function deleteSupportIncident(incidentId: number): Promise<void> {
  await api.delete(`/support/incidents/${incidentId}`);
}

export async function exportIncidentReportPdf(incidentId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/support/incidents/${incidentId}/export/pdf`, {
    responseType: "blob",
  });
  return data;
}
