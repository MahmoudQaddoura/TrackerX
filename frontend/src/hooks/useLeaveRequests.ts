/** Queries and mutations for leave requests and attendance autofill. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createLeaveRequest,
  fetchLeaveRequests,
  reviewLeaveRequest,
  type LeaveRequestPayload,
  type LeaveRequestReviewPayload,
} from "@/api/leaveRequests";

export function useLeaveRequests(scope: "mine" | "all") {
  return useQuery({
    queryKey: ["leave-requests", scope],
    queryFn: () => fetchLeaveRequests(scope),
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaveRequestPayload) => createLeaveRequest(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}

export function useReviewLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: number;
      payload: LeaveRequestReviewPayload;
    }) => reviewLeaveRequest(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
      ]);
    },
  });
}
