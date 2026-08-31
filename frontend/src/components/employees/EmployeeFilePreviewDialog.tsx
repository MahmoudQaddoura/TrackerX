import { Eye, FileWarning, Maximize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { previewEmployeeProfileFile } from "@/api/team";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/utils";
import type { EmployeeProfileFile } from "@/types";

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; mode: "pdf" | "image" | "text"; url?: string; content?: string; truncated: boolean };

export function EmployeeFilePreviewDialog({
  file,
  onClose,
}: {
  file: EmployeeProfileFile | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    if (!file) return;
    let active = true;
    let objectUrl: string | null = null;
    setPreview({ status: "loading" });
    previewEmployeeProfileFile(file.id)
      .then(async (response) => {
        const contentType = response.contentType.toLowerCase();
        if (contentType.includes("application/pdf") || contentType.startsWith("image/")) {
          objectUrl = URL.createObjectURL(response.blob);
          if (!active) return URL.revokeObjectURL(objectUrl);
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
        let message = "Preview is not available for this file type. Download the original to open it.";
        if (typeof error === "object" && error && "response" in error) {
          const response = (error as { response?: { data?: Blob } }).response;
          if (response?.data instanceof Blob) {
            try {
              const body = JSON.parse(await response.data.text()) as { detail?: string };
              if (body.detail) message = body.detail;
            } catch {
              // Keep the safe fallback.
            }
          }
        }
        setPreview({ status: "error", message });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) return null;
  const extension = file.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
  const isOfficeText = ["DOCX", "PPTX", "XLSX"].includes(extension);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[88vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Eye className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{file.file_name}</DialogTitle>
              <DialogDescription className="mt-1">
                {extension} · {formatBytes(file.file_size)} · Private employee record
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-bg/70 p-4 sm:p-5">
          {preview.status === "loading" && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-fg-muted">
              <Spinner /><p className="text-sm">Preparing secure preview…</p>
            </div>
          )}
          {preview.status === "error" && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning"><FileWarning className="h-6 w-6" /></span>
              <h3 className="mt-4 font-semibold text-fg">Preview unavailable</h3>
              <p className="mt-1 max-w-lg text-sm text-fg-muted">{preview.message}</p>
            </div>
          )}
          {preview.status === "ready" && (
            <>
              {preview.truncated && <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-fg-muted">This is a shortened preview. The original file remains unchanged.</div>}
              {preview.mode === "pdf" && preview.url && <iframe className="h-full min-h-[68vh] w-full rounded-lg border border-border bg-white" src={preview.url} title={`Preview ${file.file_name}`} />}
              {preview.mode === "image" && preview.url && <div className="flex min-h-[68vh] items-center justify-center rounded-lg border border-border bg-raised/60"><img className="max-h-[70vh] max-w-full object-contain" src={preview.url} alt={file.file_name} /></div>}
              {preview.mode === "text" && (
                <div className="rounded-lg border border-border bg-surface">
                  {isOfficeText && <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-fg-muted"><Maximize2 className="h-3.5 w-3.5" /> Extracted read-only content</div>}
                  <pre className={`max-h-[68vh] overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-6 text-fg ${isOfficeText ? "font-sans" : "font-mono"}`}>{preview.content || "This file has no previewable text content."}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
