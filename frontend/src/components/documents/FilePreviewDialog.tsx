import { Download, Eye, FileWarning, Maximize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { downloadDocument, previewDocument } from "@/api/documents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/apiClient";
import { formatBytes } from "@/lib/utils";
import type { DocumentMeta } from "@/types";

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; mode: "pdf" | "image" | "text"; url?: string; content?: string; truncated: boolean };

export function FilePreviewDialog({
  document,
  onClose,
}: {
  document: DocumentMeta | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadDocument(document);
    } catch (error) {
      setDownloadError(getApiErrorMessage(
        error,
        error instanceof Error ? error.message : "Could not download this file.",
      ));
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    if (!document) return;
    let active = true;
    let objectUrl: string | null = null;
    setPreview({ status: "loading" });

    previewDocument(document.id)
      .then(async (response) => {
        const contentType = response.contentType.toLowerCase();
        if (contentType.includes("application/pdf") || contentType.startsWith("image/")) {
          objectUrl = URL.createObjectURL(response.blob);
          if (!active) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setPreview({
            status: "ready",
            mode: contentType.includes("application/pdf") ? "pdf" : "image",
            url: objectUrl,
            truncated: response.truncated,
          });
          return;
        }
        const content = await response.blob.text();
        if (active) setPreview({ status: "ready", mode: "text", content, truncated: response.truncated });
      })
      .catch(async (error: unknown) => {
        if (!active) return;
        let message = "Preview is not available for this file type. You can still download the original file.";
        if (typeof error === "object" && error && "response" in error) {
          const response = (error as { response?: { data?: Blob } }).response;
          if (response?.data instanceof Blob) {
            try {
              const body = JSON.parse(await response.data.text()) as { detail?: string };
              if (body.detail) message = body.detail;
            } catch {
              // Keep the safe fallback message.
            }
          }
        }
        setPreview({ status: "error", message });
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document]);

  if (!document) return null;
  const extension = document.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
  const isOfficeText = ["DOCX", "PPTX", "XLSX"].includes(extension);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[88vh] max-w-6xl grid-rows-[auto_minmax(0,1fr)] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Eye className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate">{document.file_name}</DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                  <span>{extension}</span><span>·</span><span>{formatBytes(document.file_size)}</span><span>·</span><span>Secure in-app preview</span>
                </DialogDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Spinner /> : <Download className="h-4 w-4" />} Download
            </Button>
          </div>
          {downloadError && <p className="mt-2 text-sm text-danger" role="alert">{downloadError}</p>}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-bg/70 p-4 sm:p-5">
          {preview.status === "loading" && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-fg-muted">
              <Spinner />
              <p className="text-sm">Preparing preview…</p>
            </div>
          )}
          {preview.status === "error" && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
                <FileWarning className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-semibold text-fg">Preview unavailable</h3>
              <p className="mt-1 max-w-lg text-sm text-fg-muted">{preview.message}</p>
            </div>
          )}
          {preview.status === "ready" && (
            <>
              {preview.truncated && (
                <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-fg-muted">
                  This is a shortened preview of a large file. The original remains unchanged.
                </div>
              )}
              {preview.mode === "pdf" && preview.url && (
                <iframe className="h-full min-h-[68vh] w-full rounded-lg border border-border bg-white" src={preview.url} title={`Preview ${document.file_name}`} />
              )}
              {preview.mode === "image" && preview.url && (
                <div className="flex h-full min-h-[68vh] items-center justify-center rounded-lg border border-border bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[length:20px_20px]">
                  <img className="max-h-[70vh] max-w-full object-contain" src={preview.url} alt={document.file_name} />
                </div>
              )}
              {preview.mode === "text" && (
                <div className="rounded-lg border border-border bg-surface">
                  {isOfficeText && (
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-fg-muted">
                      <Maximize2 className="h-3.5 w-3.5" /> Extracted read-only content preview
                    </div>
                  )}
                  <pre className={`max-h-[68vh] overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-6 text-fg ${isOfficeText ? "font-sans" : "font-mono"}`}>
                    {preview.content || "This file has no previewable text content."}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
