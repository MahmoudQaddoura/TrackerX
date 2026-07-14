/** api/comments.ts — comments on a task or milestone. */
import { api } from "@/lib/apiClient";
import type { Comment, CommentEntity } from "@/types";

export async function fetchComments(
  entityType: CommentEntity,
  entityId: number,
): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>("/comments", {
    params: { entity_type: entityType, entity_id: entityId },
  });
  return data;
}

export async function createComment(
  entityType: CommentEntity,
  entityId: number,
  body: string,
): Promise<Comment> {
  const { data } = await api.post<Comment>(
    "/comments",
    { body },
    { params: { entity_type: entityType, entity_id: entityId } },
  );
  return data;
}

export async function deleteComment(id: number): Promise<void> {
  await api.delete(`/comments/${id}`);
}
