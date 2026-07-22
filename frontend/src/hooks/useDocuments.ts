/** hooks/useDocuments.ts — document queries + mutations for a project. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteDocument,
  fetchDocuments,
  uploadDocument,
  type UploadDocumentInput,
} from "@/api/documents";

export function useDocuments(projectId: number) {
  return useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => fetchDocuments(projectId),
    enabled: !!projectId,
    // When switching projects, immediately show empty until the new data arrives.
    // This prevents stale documents from the previous project from flashing.
    placeholderData: [],
    staleTime: 0,
  });
}

export function useDocumentMutations(projectId: number) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["documents", projectId] });

  const upload = useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(projectId, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteDocument(id), onSuccess: invalidate });

  return { upload, remove };
}