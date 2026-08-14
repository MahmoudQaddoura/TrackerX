/** hooks/useMilestones.ts — milestone queries + mutations for a project. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMilestone,
  deleteMilestone,
  fetchMilestones,
  updateMilestone,
  type MilestonePayload,
} from "@/api/milestones";

export function useMilestones(projectId: number) {
  return useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: !!projectId,
  });
}

export function useMilestoneMutations(projectId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["gantt", projectId] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const create = useMutation({
    mutationFn: (payload: MilestonePayload) => createMilestone(projectId, payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MilestonePayload }) =>
      updateMilestone(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteMilestone(id), onSuccess: invalidate });

  return { create, update, remove };
}
