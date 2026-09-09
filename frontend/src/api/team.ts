/** api/team.ts — team directory CRUD. */
import { api } from "@/lib/apiClient";
import type {
  AccessLevel,
  DelegateTasksOut,
  DelegateTasksPayload,
  EmployeeAccountRole,
  EmploymentType,
  EmployeeProfileFile,
  TeamMember,
} from "@/types";

export interface TeamMemberPayload {
  name: string;
  name_arabic?: string | null;
  role?: string | null;
  role_description?: string | null;
  employment_type?: EmploymentType;
  weekly_hours?: number | null;
  is_active?: boolean;
}

export async function fetchMember(id: number): Promise<TeamMember> {
  const { data } = await api.get<TeamMember>(`/team-members/${id}`);
  return data;
}

export async function fetchMyMemberProfile(): Promise<TeamMember> {
  const { data } = await api.get<TeamMember>("/team-members/me");
  return data;
}

export async function fetchEmployeeProfileFiles(memberId: number): Promise<EmployeeProfileFile[]> {
  const { data } = await api.get<EmployeeProfileFile[]>(`/team-members/${memberId}/profile-files`);
  return data;
}

export async function uploadEmployeeProfileFiles(
  memberId: number,
  files: File[],
): Promise<EmployeeProfileFile[]> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const { data } = await api.post<EmployeeProfileFile[]>(
    `/team-members/${memberId}/profile-files`,
    form,
  );
  return data;
}

export async function deleteEmployeeProfileFile(fileId: number): Promise<void> {
  await api.delete(`/employee-profile-files/${fileId}`);
}

export async function previewEmployeeProfileFile(fileId: number) {
  const response = await api.get<Blob>(`/employee-profile-files/${fileId}/preview`, {
    responseType: "blob",
  });
  return {
    blob: response.data,
    contentType: String(
      response.headers["content-type"] ?? response.data.type ?? "application/octet-stream",
    ),
    truncated: response.headers["x-preview-truncated"] === "true",
  };
}

export async function downloadEmployeeProfileFile(file: EmployeeProfileFile): Promise<void> {
  const response = await api.get(`/employee-profile-files/${file.id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface EmployeeCredentialsPayload {
  email: string;
  temporary_password?: string | null;
  account_role?: EmployeeAccountRole;
  access_level: AccessLevel;
  is_enabled: boolean;
}

export interface EmployeeCredentialsResult {
  user_id: number;
  email: string;
  account_role: EmployeeAccountRole;
  access_level: AccessLevel;
  is_enabled: boolean;
}

export async function fetchTeam(activeOnly = false): Promise<TeamMember[]> {
  const { data } = await api.get<TeamMember[]>("/team-members", {
    params: { active_only: activeOnly },
  });
  return data;
}

export async function createMember(payload: TeamMemberPayload): Promise<TeamMember> {
  const { data } = await api.post<TeamMember>("/team-members", payload);
  return data;
}

export async function updateMember(id: number, payload: TeamMemberPayload): Promise<TeamMember> {
  const { data } = await api.put<TeamMember>(`/team-members/${id}`, payload);
  return data;
}

export async function assignMemberProjects(
  memberId: number,
  projectIds: number[],
): Promise<TeamMember> {
  const { data } = await api.put<TeamMember>(`/team-members/${memberId}/projects`, {
    project_ids: projectIds,
  });
  return data;
}

export async function deleteMember(id: number): Promise<void> {
  await api.delete(`/team-members/${id}`);
}

export async function delegateMemberTasks(
  memberId: number,
  payload: DelegateTasksPayload,
): Promise<DelegateTasksOut> {
  const { data } = await api.post<DelegateTasksOut>(
    `/team-members/${memberId}/delegate-tasks`,
    payload,
  );
  return data;
}

export async function provisionMemberCredentials(
  memberId: number,
  payload: EmployeeCredentialsPayload,
): Promise<EmployeeCredentialsResult> {
  const { data } = await api.put<EmployeeCredentialsResult>(
    `/team-members/${memberId}/credentials`,
    payload,
  );
  return data;
}
