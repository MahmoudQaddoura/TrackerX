/** api/meetings.ts — meeting-minutes CRUD. */
import { api } from "@/lib/apiClient";
import type { Meeting } from "@/types";

export interface MeetingPayload {
  meeting_type: string;
  title: string;
  meeting_date: string;
  discussion_points?: string | null;
  outcome?: string | null;
}

export async function fetchMeetings(projectId: number, meetingType?: string): Promise<Meeting[]> {
  const { data } = await api.get<Meeting[]>(`/projects/${projectId}/meetings`, {
    params: meetingType ? { meeting_type: meetingType } : undefined,
  });
  return data;
}

export async function createMeeting(projectId: number, payload: MeetingPayload): Promise<Meeting> {
  const { data } = await api.post<Meeting>(`/projects/${projectId}/meetings`, payload);
  return data;
}

export async function updateMeeting(id: number, payload: MeetingPayload): Promise<Meeting> {
  const { data } = await api.put<Meeting>(`/meetings/${id}`, payload);
  return data;
}

export async function deleteMeeting(id: number): Promise<void> {
  await api.delete(`/meetings/${id}`);
}
