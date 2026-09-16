/** A focused document category with upload, search, download, and delete actions. */
import {
  Download,
  Eye,
  FileText,
  KeyRound,
  Link2,
  Search,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { DragEvent, FormEvent, useMemo, useState } from "react";

import { downloadDocument } from "@/api/documents";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { FilePreviewDialog } from "@/components/documents/FilePreviewDialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useDocumentMutations } from "@/hooks/useDocuments";
import { getApiErrorMessage } from "@/lib/apiClient";
import {
  encodeDocumentPlacement,
  getStorageCategory,
  type DocumentCollectionKey,
  type DocumentFolderDefinition,
} from "@/lib/documentFolders";
import { formatBytes, formatDate } from "@/lib/utils";
import type { DocumentMeta, Milestone } from "@/types";

export function FolderSection({
  projectId,
  collection,
  folder,
  icon: Icon,
  documents,
  milestones,
}: {
  projectId: number;
  collection: DocumentCollectionKey;
  folder: DocumentFolderDefinition;
  icon: LucideIcon;
  documents: DocumentMeta[];
  milestones: Milestone[];
}) {
  const { canEditProjectContent } = useAuth();
  const { uploadMany, remove } = useDocumentMutations(projectId);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<DocumentMeta | null>(null);
  const [toPreview, setToPreview] = useState<DocumentMeta | null>(null);
  const requiresMilestone = collection === "project";

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return documents;
    return documents.filter((document) => {
      const milestone = requiresMilestone
        ? milestones.find((item) => item.id === document.milestone_id)
        : null;
      return `${document.title} ${document.file_name} ${milestone?.title ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [documents, milestones, query, requiresMilestone]);

  const selectedBytes = files.reduce((total, file) => total + file.size, 0);

  function addFiles(selectedFiles: File[]) {
    const validFiles = selectedFiles.filter((file) => file.size > 0 && file.size <= 50 * 1024 * 1024);
    const rejectedFiles = selectedFiles.filter((file) => file.size === 0 || file.size > 50 * 1024 * 1024);

    setFiles((currentFiles) => {
      const knownFiles = new Set(
        currentFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      );
      const uniqueFiles = validFiles.filter(
        (file) => !knownFiles.has(`${file.name}:${file.size}:${file.lastModified}`),
      );
      return [...currentFiles, ...uniqueFiles];
    });

    setError(
      rejectedFiles.length > 0
        ? `${rejectedFiles.length} ${rejectedFiles.length === 1 ? "file was" : "files were"} skipped. Files must be between 1 byte and 50 MB.`
        : null,
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (requiresMilestone && !selectedMilestoneId) return setError("Select a milestone for this upload.");
    if (files.length === 0) return setError("Choose one or more files.");
    setError(null);
    setUploadProgress({ completed: 0, total: files.length });

    const result = await uploadMany.mutateAsync({
      documents: files.map((file) => ({
        category: getStorageCategory(folder.key),
        title: file.name,
        description: encodeDocumentPlacement(collection, folder.key),
        milestone_id: requiresMilestone ? Number(selectedMilestoneId) : null,
        file,
      })),
      onProgress: (completed, total) => setUploadProgress({ completed, total }),
    });

    if (result.failed.length === 0) {
      setFiles([]);
      setShowUpload(false);
      setSelectedMilestoneId("");
      setUploadProgress({ completed: 0, total: 0 });
      return;
    }

    const failedFiles = result.failed.map((item) => item.document.file);
    setFiles(failedFiles);
    const firstFailure = getApiErrorMessage(result.failed[0].error);
    setError(
      `${result.succeeded.length} uploaded, ${result.failed.length} failed. ${firstFailure}`,
    );
  }

  async function handleDownload(document: DocumentMeta) {
    setDownloadingId(document.id);
    setError(null);
    try {
      await downloadDocument(document);
    } catch (downloadError) {
      setError(getApiErrorMessage(
        downloadError,
        downloadError instanceof Error ? downloadError.message : "Could not download this file.",
      ));
    } finally {
      setDownloadingId(null);
    }
  }

  function closeUpload() {
    setShowUpload(false);
    setSelectedMilestoneId("");
    setFiles([]);
    setIsDragging(false);
    setUploadProgress({ completed: 0, total: 0 });
    setError(null);
  }

  return (
    <div className="rounded-lg border border-border bg-bg/35">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-fg">{folder.label}</h3>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-fg-muted">
                {documents.length} {documents.length === 1 ? "document" : "documents"}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">{folder.description}</p>
          </div>
        </div>
        {canEditProjectContent && (
          <Button
            size="sm"
            variant={showUpload ? "subtle" : "default"}
            onClick={() => (showUpload ? closeUpload() : setShowUpload(true))}
            disabled={uploadMany.isPending}
          >
            <Upload className="h-4 w-4" /> {showUpload ? "Cancel" : "Upload document"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {folder.key === "credentials" && (
          <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-fg-muted">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              Store access procedures and approved vault references here. Do not upload plaintext passwords or private keys.
            </p>
          </div>
        )}

        {canEditProjectContent && showUpload && (
          <form onSubmit={handleUpload} className="animate-slide-up rounded-lg border border-border bg-surface p-4">
            {requiresMilestone && (
              <div className="mb-4 max-w-xl">
              <Label htmlFor={`milestone-${collection}-${folder.key}`}>Link files to milestone</Label>
              <Select
                id={`milestone-${collection}-${folder.key}`}
                className="mt-1.5"
                value={selectedMilestoneId}
                onChange={(event) => {
                  setSelectedMilestoneId(event.target.value);
                  setError(null);
                }}
                disabled={uploadMany.isPending || milestones.length === 0}
                required
              >
                <option value="">Select a milestone…</option>
                {milestones.map((milestone, index) => (
                  <option key={milestone.id} value={milestone.id}>
                    {index + 1}. {milestone.title}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-fg-muted">
                {milestones.length > 0
                  ? "Every file in this batch will be tagged to this milestone and shown in Kanban."
                  : "Create a project milestone before uploading documents."}
              </p>
              </div>
            )}

            <div
              className={`rounded-lg border-2 border-dashed px-5 py-7 text-center transition-colors ${
                isDragging ? "border-accent bg-accent-soft" : "border-border bg-bg/40 hover:border-accent/50"
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <input
                id={`files-${collection}-${folder.key}`}
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
                disabled={uploadMany.isPending}
              />
              <label
                htmlFor={`files-${collection}-${folder.key}`}
                className="inline-flex cursor-pointer flex-col items-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Upload className="h-5 w-5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-fg">
                  Drop files here or <span className="text-accent">browse</span>
                </span>
                <span className="mt-1 text-xs text-fg-muted">
                  Select multiple files · 50 MB maximum per file
                </span>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-raised/60 px-3 py-2">
                  <p className="text-xs font-semibold text-fg">
                    {files.length} {files.length === 1 ? "file" : "files"} selected · {formatBytes(selectedBytes)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiles([])}
                    disabled={uploadMany.isPending}
                  >
                    Clear all
                  </Button>
                </div>
                <ul className="max-h-44 divide-y divide-border overflow-y-auto">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-fg-subtle" />
                        <span className="truncate text-xs font-medium text-fg">{file.name}</span>
                        <span className="shrink-0 text-xs text-fg-subtle">{formatBytes(file.size)}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                        disabled={uploadMany.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5">
                {uploadMany.isPending && (
                  <p className="text-xs font-medium text-fg-muted">
                    Uploading {uploadProgress.completed} of {uploadProgress.total} files…
                  </p>
                )}
                {error && <p className="text-sm text-danger">{error}</p>}
              </div>
              <Button
                type="submit"
                disabled={files.length === 0 || (requiresMilestone && !selectedMilestoneId) || uploadMany.isPending}
              >
                {uploadMany.isPending && <Spinner />}
                Upload {files.length || "selected"} {files.length === 1 ? "file" : "files"}
              </Button>
            </div>
          </form>
        )}

        {!showUpload && error && <p className="text-sm text-danger">{error}</p>}

        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={`No documents in ${folder.label} yet`}
            description="Documents uploaded to this category will be listed here by newest first."
            action={
              canEditProjectContent ? (
                <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
                  <Upload className="h-4 w-4" /> Upload first document
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${folder.label.toLocaleLowerCase()}…`}
                aria-label={`Search ${folder.label} documents`}
                className="pl-9"
              />
            </div>

            {visibleDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <p className="text-sm font-medium text-fg">No matching documents</p>
                <p className="mt-1 text-xs text-fg-muted">Try a different title or file name.</p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                {visibleDocuments.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-4"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setToPreview(document)}
                      aria-label={`Preview ${document.title}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-raised text-fg-muted">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{document.title}</p>
                        <p className="mt-0.5 truncate text-xs text-fg-subtle">
                          {document.file_name} · {formatBytes(document.file_size)} · {formatDate(document.created_at)}
                        </p>
                        {requiresMilestone && (
                          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                          <Link2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {document.milestone_id
                              ? milestones.find((milestone) => milestone.id === document.milestone_id)?.title ??
                                "Milestone unavailable"
                              : "Unlinked legacy file"}
                          </span>
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Preview ${document.title}`}
                        title="Preview"
                        onClick={() => setToPreview(document)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${document.title}`}
                        title="Download"
                        onClick={() => handleDownload(document)}
                        disabled={downloadingId === document.id}
                      >
                        {downloadingId === document.id ? <Spinner /> : <Download className="h-4 w-4" />}
                      </Button>
                      {canEditProjectContent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${document.title}`}
                          title="Delete"
                          onClick={() => setToDelete(document)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete document"
        description={`Delete "${toDelete?.title}"? This removes the file permanently.`}
        isPending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
      <FilePreviewDialog document={toPreview} onClose={() => setToPreview(null)} />
    </div>
  );
}
