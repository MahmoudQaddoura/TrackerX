/**
 * documents/FolderSection.tsx
 * A single document folder: file list with download/delete plus a collapsible
 * upload form (PM only).
 */
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { FormEvent, useState } from "react";

import { downloadDocument } from "@/api/documents";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useDocumentMutations } from "@/hooks/useDocuments";
import { getApiErrorMessage } from "@/lib/apiClient";
import { formatBytes, formatDate } from "@/lib/utils";
import type { DocumentCategory, DocumentMeta } from "@/types";

export function FolderSection({
  projectId,
  folder,
  documents,
}: {
  projectId: number;
  folder: { key: DocumentCategory; label: string; description: string };
  documents: DocumentMeta[];
}) {
  const { canManage } = useAuth();
  const { upload, remove } = useDocumentMutations(projectId);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<DocumentMeta | null>(null);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a file.");
    if (!title.trim()) return setError("Title is required.");
    try {
      await upload.mutateAsync({ category: folder.key, title: title.trim(), file });
      setTitle("");
      setFile(null);
      setShowUpload(false);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleDownload(doc: DocumentMeta) {
    setDownloadingId(doc.id);
    try {
      await downloadDocument(doc);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{folder.label}</CardTitle>
          <p className="text-xs text-fg-subtle">{folder.description}</p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setShowUpload((s) => !s)}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canManage && showUpload && (
          <form onSubmit={handleUpload} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`title-${folder.key}`}>Title</Label>
              <Input id={`title-${folder.key}`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`file-${folder.key}`}>File (max 10 MB)</Label>
              <Input
                id={`file-${folder.key}`}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={upload.isPending}>
                {upload.isPending && <Spinner />} Save
              </Button>
            </div>
          </form>
        )}

        {documents.length === 0 ? (
          <p className="py-2 text-sm text-fg-subtle">No documents in this folder yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-fg-subtle" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{doc.title}</p>
                    <p className="truncate text-xs text-fg-subtle">
                      {doc.file_name} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Download"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                  >
                    {downloadingId === doc.id ? <Spinner /> : <Download className="h-4 w-4" />}
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={() => setToDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete document"
        description={`Delete "${toDelete?.title}"? This removes the file permanently.`}
        isPending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </Card>
  );
}
