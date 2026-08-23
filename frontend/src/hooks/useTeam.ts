/** hooks/useTeam.ts — team directory queries + mutations. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMember,
  deleteMember,
  fetchTeam,
  updateMember,
  type TeamMemberPayload,
} from "@/api/team";

export function useTeam(activeOnly = false, enabled = true) {
  return useQuery({
    queryKey: ["team", activeOnly],
    queryFn: () => fetchTeam(activeOnly),
    enabled,
  });
}

export function useTeamMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["team"] });

  const create = useMutation({ mutationFn: (p: TeamMemberPayload) => createMember(p), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TeamMemberPayload }) => updateMember(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteMember(id), onSuccess: invalidate });

  return { create, update, remove };
}
