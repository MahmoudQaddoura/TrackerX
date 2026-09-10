/** Date-scoped attendance query and bulk save. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  confirmMyAttendance,
  fetchAttendance,
  fetchMyAttendance,
  saveAttendance,
  type AttendanceConfirmationInput,
  type AttendanceInput,
} from "@/api/attendance";

export function useAttendance(date: string) {
  return useQuery({
    queryKey: ["attendance", date],
    queryFn: () => fetchAttendance(date),
  });
}

export function useSaveAttendance(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (records: AttendanceInput[]) => saveAttendance(records),
    onSuccess: (records) => queryClient.setQueryData(["attendance", date], records),
  });
}

export function useMyAttendance() {
  return useQuery({
    queryKey: ["attendance", "me", "today"],
    queryFn: fetchMyAttendance,
  });
}

export function useConfirmAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceConfirmationInput) => confirmMyAttendance(payload),
    onSuccess: async (record) => {
      queryClient.setQueryData(["attendance", "me", "today"], record);
      await queryClient.invalidateQueries({ queryKey: ["attendance", record.attendance_date] });
    },
  });
}
