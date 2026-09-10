/** Employee leave submissions and administrator review transport. */
import { api } from "@/lib/apiClient";
import type {
  CoverageOffer,
  CoveragePlan,
  LeaveDurationUnit,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@/types";

export interface LeaveRequestPayload {
  request_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  duration_unit: LeaveDurationUnit;
  start_time?: string | null;
  end_time?: string | null;
  reason: string;
}

export interface LeaveRequestReviewPayload {
  status: Extract<LeaveRequestStatus, "approved" | "rejected">;
  review_note?: string | null;
  autofill_attendance: boolean;
}

export async function fetchLeaveRequests(scope: "mine" | "all" | "reviewable"): Promise<LeaveRequest[]> {
  const { data } = await api.get<LeaveRequest[]>("/leave-requests", { params: { scope } });
  return data;
}

export async function createLeaveRequest(payload: LeaveRequestPayload): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>("/leave-requests", payload);
  return data;
}

export async function reviewLeaveRequest(
  requestId: number,
  payload: LeaveRequestReviewPayload,
): Promise<LeaveRequest> {
  const { data } = await api.put<LeaveRequest>(`/leave-requests/${requestId}/review`, payload);
  return data;
}

export interface CoverageAssignmentPayload {
  task_id: number;
  to_member_id: number;
}

export interface AssignCoveragePayload {
  assignments: CoverageAssignmentPayload[];
  review_note?: string | null;
  coverage_note?: string | null;
  autofill_attendance: boolean;
}

export async function fetchCoveragePlan(requestId: number): Promise<CoveragePlan> {
  const { data } = await api.get<CoveragePlan>(`/leave-requests/${requestId}/coverage-plan`);
  return data;
}

export async function assignLeaveCoverage(
  requestId: number,
  payload: AssignCoveragePayload,
): Promise<{ leave_request_id: number; leave_status: string; offers_created: number; offers: CoverageOffer[] }> {
  const { data } = await api.post(`/leave-requests/${requestId}/coverage`, payload);
  return data;
}

export async function fetchCoverageOffers(
  status: "pending" | "accepted" | "declined" | "all" = "pending",
): Promise<CoverageOffer[]> {
  const { data } = await api.get<CoverageOffer[]>("/coverage-offers/mine", { params: { status } });
  return data;
}

export async function respondToCoverageOffer(
  offerId: number,
  action: "accepted" | "declined",
  responseNote?: string | null,
): Promise<CoverageOffer> {
  const { data } = await api.patch<CoverageOffer>(`/coverage-offers/${offerId}/respond`, {
    action,
    response_note: responseNote,
  });
  return data;
}
