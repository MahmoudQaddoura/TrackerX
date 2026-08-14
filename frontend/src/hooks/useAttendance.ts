/** Date-scoped attendance query and bulk save. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAttendance, saveAttendance, type AttendanceInput } from "@/api/attendance";

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
