/** Daily employee attendance sheet transport. */
import { api } from "@/lib/apiClient";
import type { AttendanceRecord, AttendanceStatus } from "@/types";

export interface AttendanceInput {
  team_member_id: number;
  attendance_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
}

export interface AttendanceConfirmationInput {
  action: "check_in" | "check_out";
  work_mode: "present" | "remote";
  notes?: string | null;
}

export async function fetchAttendance(date: string): Promise<AttendanceRecord[]> {
  const { data } = await api.get<AttendanceRecord[]>("/attendance", { params: { date } });
  return data;
}

export async function fetchMyAttendance(): Promise<AttendanceRecord> {
  const { data } = await api.get<AttendanceRecord>("/attendance/me");
  return data;
}

export async function confirmMyAttendance(
  payload: AttendanceConfirmationInput,
): Promise<AttendanceRecord> {
  const { data } = await api.put<AttendanceRecord>("/attendance/me/confirm", payload);
  return data;
}

export async function saveAttendance(records: AttendanceInput[]): Promise<AttendanceRecord[]> {
  const { data } = await api.put<AttendanceRecord[]>("/attendance/bulk", { records });
  return data;
}

export async function exportAttendancePdf(records: AttendanceInput[]): Promise<Blob> {
  const { data } = await api.post<Blob>(
    "/attendance/export/pdf",
    { records },
    { responseType: "blob" },
  );
  return data;
}

export async function exportMonthlyDaysOffPdf(month: string): Promise<Blob> {
  const { data } = await api.get<Blob>("/attendance/export/monthly-pdf", {
    params: { month },
    responseType: "blob",
  });
  return data;
}
