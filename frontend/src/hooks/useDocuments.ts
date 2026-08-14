/** hooks/useDocuments.ts — document queries + mutations for a project. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteDocument,
  fetchDocuments,
  uploadDocument,
  type UploadDocumentInput,
} from "@/api/documents";

export interface BulkDocumentUploadInput {
  documents: UploadDocumentInput[];
  onProgress?: (completed: number, total: number) => void;
}

export interface BulkDocumentUploadResult {
  succeeded: UploadDocumentInput[];
  failed: { document: UploadDocumentInput; error: unknown }[];
}

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
  const uploadMany = useMutation({
    mutationFn: async ({ documents, onProgress }: BulkDocumentUploadInput) => {
      const result: BulkDocumentUploadResult = { succeeded: [], failed: [] };
      let nextIndex = 0;
      let completed = 0;

      // Three concurrent uploads keep a large batch moving without flooding
      // the API or holding every selected file in memory at once.
      async function worker() {
        while (nextIndex < documents.length) {
          const document = documents[nextIndex++];
          try {
            await uploadDocument(projectId, document);
            result.succeeded.push(document);
          } catch (error) {
            result.failed.push({ document, error });
          } finally {
            completed += 1;
            onProgress?.(completed, documents.length);
          }
        }
      }

      const workerCount = Math.min(3, documents.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      return result;
    },
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteDocument(id), onSuccess: invalidate });

  return { upload, uploadMany, remove };
}
