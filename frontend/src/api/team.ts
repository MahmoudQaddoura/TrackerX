/** api/team.ts — team directory CRUD. */
import { api } from "@/lib/apiClient";
import type {
  AccessLevel,
  DelegateTasksOut,
  DelegateTasksPayload,
  EmployeeAccountRole,
  TeamMember,
} from "@/types";

export interface TeamMemberPayload {
  name: string;
  role?: string | null;
  is_active?: boolean;
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
