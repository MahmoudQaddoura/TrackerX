/** Queries and mutations for leave requests and attendance autofill. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignLeaveCoverage,
  createLeaveRequest,
  fetchCoverageOffers,
  fetchCoveragePlan,
  fetchLeaveRequests,
  reviewLeaveRequest,
  respondToCoverageOffer,
  type AssignCoveragePayload,
  type LeaveRequestPayload,
  type LeaveRequestReviewPayload,
} from "@/api/leaveRequests";

export function useLeaveRequests(scope: "mine" | "all" | "reviewable", enabled = true) {
  return useQuery({
    queryKey: ["leave-requests", scope],
    queryFn: () => fetchLeaveRequests(scope),
    enabled,
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

export function useCoveragePlan(requestId: number | null) {
  return useQuery({
    queryKey: ["leave-coverage-plan", requestId],
    queryFn: () => fetchCoveragePlan(requestId!),
    enabled: !!requestId,
  });
}

export function useAssignLeaveCoverage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: AssignCoveragePayload }) =>
      assignLeaveCoverage(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["leave-coverage-plan"] }),
        queryClient.invalidateQueries({ queryKey: ["coverage-offers"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
    },
  });
}

export function useCoverageOffers(status: "pending" | "accepted" | "declined" | "all" = "pending") {
  return useQuery({
    queryKey: ["coverage-offers", status],
    queryFn: () => fetchCoverageOffers(status),
  });
}

export function useRespondToCoverageOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, action, responseNote }: { offerId: number; action: "accepted" | "declined"; responseNote?: string | null }) =>
      respondToCoverageOffer(offerId, action, responseNote),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coverage-offers"] }),
        queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["team"] }),
      ]);
    },
  });
}
