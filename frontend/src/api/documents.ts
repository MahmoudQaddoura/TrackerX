/** api/documents.ts — document list/upload/download/delete. */
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

/** Download a file as an attachment (never rendered inline). */
export async function downloadDocument(doc: DocumentMeta): Promise<void> {
  const response = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
