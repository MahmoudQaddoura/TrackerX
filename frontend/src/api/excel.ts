import { api } from "@/lib/apiClient";

export type ExcelWorkspace = "kanban" | "assets";

export interface ExcelImportIssue {
  sheet: string;
  row: number;
  field: string;
  message: string;
}

export interface ExcelImportResult {
  workspace: ExcelWorkspace;
  valid: boolean;
  committed: boolean;
  rows_read: number;
  counts: Record<string, number>;
  warnings: string[];
  errors: ExcelImportIssue[];
}

function paths(projectId: number, workspace: ExcelWorkspace) {
  return workspace === "kanban"
    ? {
        export: `/projects/${projectId}/kanban/excel`,
        template: `/projects/${projectId}/kanban/excel-template`,
        upload: `/projects/${projectId}/kanban/import-excel`,
      }
    : {
        export: `/projects/${projectId}/assets/export/excel`,
        template: `/projects/${projectId}/assets/excel-template`,
        upload: `/projects/${projectId}/assets/import-excel`,
      };
}

export async function downloadWorkspaceExcel(
  projectId: number,
  workspace: ExcelWorkspace,
  template = false,
): Promise<Blob> {
  const endpoint = paths(projectId, workspace)[template ? "template" : "export"];
  const { data } = await api.get<Blob>(endpoint, { responseType: "blob" });
  return data;
}

export async function uploadWorkspaceExcel(
  projectId: number,
  workspace: ExcelWorkspace,
  file: File,
  commit: boolean,
): Promise<ExcelImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("commit", String(commit));
  const { data } = await api.post<ExcelImportResult>(paths(projectId, workspace).upload, form);
  return data;
}
