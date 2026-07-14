/** hooks/useMeetings.ts — meeting queries + mutations for a project. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMeeting,
  deleteMeeting,
  fetchMeetings,
  updateMeeting,
  type MeetingPayload,
} from "@/api/meetings";

export function useMeetings(projectId: number, meetingType?: string) {
  return useQuery({
    queryKey: ["meetings", projectId, meetingType ?? "all"],
    queryFn: () => fetchMeetings(projectId, meetingType),
    enabled: !!projectId,
  });
}

export function useMeetingMutations(projectId: number) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["meetings", projectId] });

  const create = useMutation({
    mutationFn: (payload: MeetingPayload) => createMeeting(projectId, payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MeetingPayload }) => updateMeeting(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteMeeting(id), onSuccess: invalidate });

  return { create, update, remove };
}
