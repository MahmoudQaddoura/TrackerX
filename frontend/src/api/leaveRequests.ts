/** Employee leave submissions and administrator review transport. */
import { api } from "@/lib/apiClient";
import type {
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

export async function fetchLeaveRequests(scope: "mine" | "all"): Promise<LeaveRequest[]> {
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
