/**
 * documents/DocumentRepository.tsx
 * One folder section per category. PMs can upload/delete; everyone can download
 * (files are downloaded, never previewed in the browser).
 */
import { DocumentMeta } from "@/types";
import { FolderSection } from "@/components/documents/FolderSection";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/useDocuments";
import { DOCUMENT_FOLDERS } from "@/lib/documentFolders";

export function DocumentRepository({ projectId }: { projectId: number }) {
  const { data, isLoading, isError, refetch } = useDocuments(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {DOCUMENT_FOLDERS.map((f) => (
          <Skeleton key={f.key} className="h-28" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState message="Could not load documents." onRetry={() => refetch()} />;

  const byCategory = (cat: string): DocumentMeta[] =>
    (data ?? []).filter((d) => d.category === cat);

  return (
    <div className="flex flex-col gap-4">
      {DOCUMENT_FOLDERS.map((folder) => (
        <FolderSection
          key={folder.key}
          projectId={projectId}
          folder={folder}
          documents={byCategory(folder.key)}
        />
      ))}
    </div>
  );
}
