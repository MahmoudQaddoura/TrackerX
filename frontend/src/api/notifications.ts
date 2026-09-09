import { api } from "@/lib/apiClient";
import type { TrackerNotification } from "@/types";

export async function fetchNotifications(): Promise<TrackerNotification[]> {
  const { data } = await api.get<TrackerNotification[]>("/notifications", { params: { limit: 30 } });
  return data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("/notifications/read-all");
}
