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
  detected_format?: string;
  suggested_workspace?: ExcelWorkspace;
  detected_tables?: Array<{
    sheet: string;
    kind: string;
    header_row: number | null;
    confidence: number;
    rows: number;
    mapping: Array<{ source: string; target: string }>;
  }>;
  manual_fields?: string[];
}

export interface ExcelImportOptions {
  defaultEnvironment?: "production" | "staging" | "development" | "test" | "disaster_recovery" | "other";
  defaultConnectionStatus?: "connected" | "closed" | "not_needed";
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
  options: ExcelImportOptions = {},
): Promise<ExcelImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("commit", String(commit));
  if (workspace === "assets") {
    form.append("default_environment", options.defaultEnvironment ?? "other");
    form.append("default_connection_status", options.defaultConnectionStatus ?? "connected");
  }
  const { data } = await api.post<ExcelImportResult>(paths(projectId, workspace).upload, form);
  return data;
}
