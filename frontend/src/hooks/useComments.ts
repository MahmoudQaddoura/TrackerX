/** hooks/useComments.ts — comment thread queries + mutations for an entity. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createComment, deleteComment, fetchComments } from "@/api/comments";
import type { CommentEntity } from "@/types";

export function useComments(entityType: CommentEntity, entityId: number) {
  return useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => fetchComments(entityType, entityId),
    enabled: !!entityId,
  });
}

export function useCommentMutations(entityType: CommentEntity, entityId: number) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["comments", entityType, entityId] });

  const create = useMutation({
    mutationFn: (body: string) => createComment(entityType, entityId, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteComment(id), onSuccess: invalidate });

  return { create, remove };
}
