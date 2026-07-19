/** api/team.ts — team directory CRUD. */
import { api } from "@/lib/apiClient";
import type { TeamMember } from "@/types";

export interface TeamMemberPayload {
  name: string;
  role?: string | null;
  is_active?: boolean;
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

export async function deleteMember(id: number): Promise<void> {
  await api.delete(`/team-members/${id}`);
}
