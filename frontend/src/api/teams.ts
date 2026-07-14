/** api/teams.ts — team CRUD + roster attach/detach. */
import { api } from "@/lib/apiClient";
import type { Team } from "@/types";

export interface TeamPayload {
  name: string;
  function?: string | null;
  lead_user_id?: number | null;
  weekly_capacity_days?: number | null;
  project_ids?: number[];
}

export interface AttachMemberPayload {
  team_member_id?: number;
  name?: string;
  role?: string | null;
}

export async function fetchTeams(): Promise<Team[]> {
  const { data } = await api.get<Team[]>("/teams");
  return data;
}

export async function createTeam(payload: TeamPayload): Promise<Team> {
  const { data } = await api.post<Team>("/teams", payload);
  return data;
}

export async function updateTeam(id: number, payload: Partial<TeamPayload>): Promise<Team> {
  const { data } = await api.put<Team>(`/teams/${id}`, payload);
  return data;
}

export async function deleteTeam(id: number): Promise<void> {
  await api.delete(`/teams/${id}`);
}

export async function attachTeamMember(teamId: number, payload: AttachMemberPayload): Promise<Team> {
  const { data } = await api.post<Team>(`/teams/${teamId}/members`, payload);
  return data;
}

export async function detachTeamMember(teamId: number, memberId: number): Promise<Team> {
  const { data } = await api.delete<Team>(`/teams/${teamId}/members/${memberId}`);
  return data;
}
