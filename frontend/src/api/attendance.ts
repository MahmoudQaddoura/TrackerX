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

export async function fetchAttendance(date: string): Promise<AttendanceRecord[]> {
  const { data } = await api.get<AttendanceRecord[]>("/attendance", { params: { date } });
  return data;
}

export async function saveAttendance(records: AttendanceInput[]): Promise<AttendanceRecord[]> {
  const { data } = await api.put<AttendanceRecord[]>("/attendance/bulk", { records });
  return data;
}
