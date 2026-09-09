import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/notifications";

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, enabled, refetchInterval: 30_000 });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  return {
    read: useMutation({ mutationFn: markNotificationRead, onSuccess: refresh }),
    readAll: useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh }),
  };
}
