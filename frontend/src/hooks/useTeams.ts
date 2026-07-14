/** hooks/useTeams.ts — team queries + mutations. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  attachTeamMember,
  createTeam,
  deleteTeam,
  detachTeamMember,
  fetchTeams,
  updateTeam,
  type AttachMemberPayload,
  type TeamPayload,
} from "@/api/teams";

export function useTeams() {
  return useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
}

export function useTeamMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["team"] });
  };

  const create = useMutation({ mutationFn: (p: TeamPayload) => createTeam(p), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TeamPayload> }) =>
      updateTeam(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteTeam(id), onSuccess: invalidate });
  const attachMember = useMutation({
    mutationFn: ({ teamId, payload }: { teamId: number; payload: AttachMemberPayload }) =>
      attachTeamMember(teamId, payload),
    onSuccess: invalidate,
  });
  const detachMember = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: number; memberId: number }) =>
      detachTeamMember(teamId, memberId),
    onSuccess: invalidate,
  });

  return { create, update, remove, attachMember, detachMember };
}
