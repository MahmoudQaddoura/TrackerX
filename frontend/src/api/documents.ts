/** api/documents.ts — document list/upload/download/delete. */
import axios from "axios";

import { api } from "@/lib/apiClient";
import type { DocumentMeta } from "@/types";

export async function fetchDocuments(
  projectId: number,
  params?: { category?: string; milestone_id?: number },
): Promise<DocumentMeta[]> {
  const { data } = await api.get<DocumentMeta[]>(`/projects/${projectId}/documents`, { params });
  return data;
}

export interface UploadDocumentInput {
  category: string;
  title: string;
  description?: string;
  milestone_id?: number | null;
  file: File;
}

export async function uploadDocument(
  projectId: number,
  input: UploadDocumentInput,
): Promise<DocumentMeta> {
  const form = new FormData();
  form.append("category", input.category);
  form.append("title", input.title);
  if (input.description) form.append("description", input.description);
  if (input.milestone_id != null) form.append("milestone_id", String(input.milestone_id));
  form.append("file", input.file);
  const { data } = await api.post<DocumentMeta>(`/projects/${projectId}/documents`, form);
  return data;
}

export async function deleteDocument(id: number): Promise<void> {
  await api.delete(`/documents/${id}`);
}

export interface DocumentPreviewResponse {
  blob: Blob;
  contentType: string;
  truncated: boolean;
}

export async function previewDocument(id: number): Promise<DocumentPreviewResponse> {
  const response = await api.get<Blob>(`/documents/${id}/preview`, { responseType: "blob" });
  return {
    blob: response.data,
    contentType: String(
      response.headers["content-type"] ?? response.data.type ?? "application/octet-stream",
    ),
    truncated: response.headers["x-preview-truncated"] === "true",
  };
}

/** Download a file as an attachment (never rendered inline). */
export async function downloadDocument(doc: DocumentMeta): Promise<void> {
  let file: Blob;
  try {
    const response = await api.get<Blob>(`/documents/${doc.id}/download`, { responseType: "blob" });
    file = response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      let detail: unknown;
      try {
        detail = (JSON.parse(await error.response.data.text()) as { detail?: unknown }).detail;
      } catch {
        // Keep the original HTTP error if the response is not JSON.
      }
      if (typeof detail === "string") throw new Error(detail);
    }
    throw error;
  }
  if (file.size === 0) throw new Error("The downloaded file is empty.");
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the object URL alive until the browser has begun saving the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
