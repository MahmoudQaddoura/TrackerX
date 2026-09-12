import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  GitMerge,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  downloadWorkspaceExcel,
  uploadWorkspaceExcel,
  type ExcelImportResult,
  type ExcelWorkspace,
} from "@/api/excel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface ExcelTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  workspace: ExcelWorkspace;
  canImport: boolean;
  hasRecords: boolean;
}

const COUNT_LABELS: Record<string, string> = {
  milestones_create: "Milestones to create",
  milestones_update: "Milestones to update",
  tasks_create: "Tasks to create",
  tasks_update: "Tasks to update",
  assets_create: "Assets to create",
  assets_update: "Assets to update",
  ports_create: "Ports to create",
  ports_update: "Ports to update",
  connections_create: "Connections to create",
  connections_update: "Connections to update",
  unchanged: "Unchanged",
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ExcelTransferDialog({
  open,
  onOpenChange,
  projectId,
  workspace,
  canImport,
  hasRecords,
}: ExcelTransferDialogProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelImportResult | null>(null);
  const [busy, setBusy] = useState<"export" | "template" | "preview" | "commit" | null>(null);
  const [error, setError] = useState("");
  const [defaultEnvironment, setDefaultEnvironment] = useState<"production" | "staging" | "development" | "test" | "disaster_recovery" | "other">("other");
  const [defaultConnectionStatus, setDefaultConnectionStatus] = useState<"connected" | "closed" | "not_needed">("connected");
  const label = workspace === "kanban" ? "Kanban board" : "Asset inventory";
  const baseFilename = `trackerx-project-${projectId}-${workspace === "kanban" ? "kanban" : "asset-inventory"}`;
  const importScope = workspace === "kanban"
    ? "TrackerX detects task and milestone tables, maps familiar column names, and groups task-only sheets into a safe milestone."
    : "TrackerX detects asset registers and network allowlists, merges repeated assets by IP, and builds ports and connectivity rules.";

  const importOptions = { defaultEnvironment, defaultConnectionStatus };

  function reset() {
    setFile(null);
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function download(template: boolean) {
    setBusy(template ? "template" : "export");
    setError("");
    try {
      const blob = await downloadWorkspaceExcel(projectId, workspace, template);
      saveBlob(blob, `${baseFilename}${template ? "-template" : ""}.xlsx`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not download the Excel workbook."));
    } finally {
      setBusy(null);
    }
  }

  async function selectFile(selected: File | null, options = importOptions) {
    setFile(selected);
    setPreview(null);
    setError("");
    if (!selected) return;
    if (!selected.name.toLocaleLowerCase().endsWith(".xlsx")) {
      setError("Choose an Excel .xlsx workbook.");
      return;
    }
    setBusy("preview");
    try {
      setPreview(await uploadWorkspaceExcel(projectId, workspace, selected, false, options));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not validate this workbook."));
    } finally {
      setBusy(null);
    }
  }

  async function commitImport() {
    if (!file || !preview?.valid) return;
    setBusy("commit");
    setError("");
    try {
      const result = await uploadWorkspaceExcel(projectId, workspace, file, true, importOptions);
      setPreview(result);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
        qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
        qc.invalidateQueries({ queryKey: ["project", projectId] }),
        qc.invalidateQueries({ queryKey: ["gantt", projectId] }),
        qc.invalidateQueries({ queryKey: ["analytics"] }),
        qc.invalidateQueries({ queryKey: ["assets", projectId] }),
        qc.invalidateQueries({ queryKey: ["asset-matrix", projectId] }),
      ]);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not import this workbook."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <DialogTitle>{label} Excel</DialogTitle>
          <DialogDescription>
            Export the complete current workspace, download a clean template, or preview a workbook before applying it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy !== null || !hasRecords}
            onClick={() => void download(false)}
            className="group rounded-xl border border-border bg-raised/35 p-4 text-left transition hover:border-accent/30 hover:bg-accent-soft/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
                {busy === "export" ? <Spinner /> : <FileDown className="h-5 w-5" />}
              </span>
              <Download className="h-4 w-4 text-fg-subtle group-hover:text-accent" />
            </span>
            <span className="mt-3 block font-semibold text-fg">Export current data</span>
            <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
              IDs and every editable field are included for reliable round-trip updates.
            </span>
          </button>
          <button
            type="button"
            disabled={busy !== null || !canImport}
            onClick={() => void download(true)}
            className="group rounded-xl border border-border bg-raised/35 p-4 text-left transition hover:border-accent/30 hover:bg-accent-soft/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-accent ring-1 ring-border">
                {busy === "template" ? <Spinner /> : <FileSpreadsheet className="h-5 w-5" />}
              </span>
              <Download className="h-4 w-4 text-fg-subtle group-hover:text-accent" />
            </span>
            <span className="mt-3 block font-semibold text-fg">Download blank template</span>
            <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
              Structured sheets, TrackerX field names, and import guidance without sample records.
            </span>
          </button>
        </div>

        {canImport ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-fg">Import workbook</h3>
                <p className="mt-1 text-xs text-fg-muted">Preview is mandatory. Nothing is written until validation passes and you confirm.</p>
              </div>
              <Badge variant="outline"><ShieldCheck className="h-3.5 w-3.5" /> Safe merge</Badge>
            </div>
            <div className="mt-4 rounded-lg border border-accent/15 bg-accent-soft/30 px-3 py-2 text-xs leading-relaxed text-fg-muted">
              {importScope} Import is non-destructive: rows missing from the workbook are never deleted.
            </div>
            {workspace === "assets" && (
              <div className="mt-4 grid gap-3 rounded-xl border border-border bg-raised/25 p-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-fg-muted">
                  When environment is missing
                  <select
                    value={defaultEnvironment}
                    disabled={busy !== null}
                    onChange={(event) => {
                      const next = event.target.value as typeof defaultEnvironment;
                      setDefaultEnvironment(next);
                      if (file) void selectFile(file, { defaultEnvironment: next, defaultConnectionStatus });
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg"
                  >
                    <option value="other">Other — complete later</option>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                    <option value="test">Test / UAT</option>
                    <option value="disaster_recovery">Disaster recovery</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-fg-muted">
                  New network rules mean
                  <select
                    value={defaultConnectionStatus}
                    disabled={busy !== null}
                    onChange={(event) => {
                      const next = event.target.value as typeof defaultConnectionStatus;
                      setDefaultConnectionStatus(next);
                      if (file) void selectFile(file, { defaultEnvironment, defaultConnectionStatus: next });
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg"
                  >
                    <option value="connected">Connected / required</option>
                    <option value="closed">Closed / blocked</option>
                    <option value="not_needed">Not needed</option>
                  </select>
                </label>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void selectFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-raised/30 px-4 py-4 text-left hover:border-accent/40 hover:bg-accent-soft/25",
                file && "border-accent/30 bg-accent-soft/20",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {busy === "preview" ? <Spinner /> : <Upload className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-fg">{file?.name ?? "Choose or drop an .xlsx file"}</span>
                <span className="block text-xs text-fg-muted">Maximum 8 MB. Formulas in imported fields, macros, and external workbook links are rejected.</span>
              </span>
            </button>

            {preview && (
              <div className={cn("mt-4 rounded-xl border p-4", preview.valid ? "border-success/25 bg-success/5" : "border-danger/25 bg-danger/5")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-fg">
                    {preview.committed ? <CheckCircle2 className="h-5 w-5 text-success" /> : preview.valid ? <ShieldCheck className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-danger" />}
                    {preview.committed ? "Import complete" : preview.valid ? "Workbook is ready" : "Fix workbook errors"}
                  </span>
                  <Badge variant={preview.valid ? "success" : "danger"}>{preview.rows_read} rows read</Badge>
                </div>
                {preview.detected_format && (
                  <div className="mt-3 rounded-xl border border-accent/20 bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                        <GitMerge className="h-4 w-4 text-accent" />
                        TrackerX understood this workbook
                      </span>
                      <Badge variant="outline">{preview.detected_format.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {preview.detected_tables?.map((table) => (
                        <div key={`${table.sheet}-${table.header_row}`} className="rounded-lg bg-raised/55 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-fg">{table.sheet} · {table.rows} data rows</span>
                            <span className="text-fg-subtle">{table.confidence}% mapping confidence</span>
                          </div>
                          {table.mapping.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {table.mapping.map((item) => (
                                <span key={`${item.source}-${item.target}`} className="rounded-full border border-border bg-surface px-2 py-1 text-[10px] text-fg-muted">
                                  {item.source} → <strong className="text-fg">{item.target}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {(preview.manual_fields?.length ?? 0) > 0 && (
                      <div className="mt-3 border-t border-border pt-2 text-xs text-fg-muted">
                        <p className="font-semibold text-fg">Safe defaults and manual follow-up</p>
                        {preview.manual_fields?.map((item) => <p key={item} className="mt-1">• {item}</p>)}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(preview.counts).filter(([, value]) => value > 0).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-border/70 bg-surface px-3 py-2">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{COUNT_LABELS[key] ?? key.replace(/_/g, " ")}</span>
                      <span className="text-lg font-bold text-fg">{value}</span>
                    </div>
                  ))}
                </div>
                {preview.warnings.length > 0 && (
                  <div className="mt-3 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-fg-muted">
                    {preview.warnings.slice(0, 5).map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                )}
                {preview.errors.length > 0 && (
                  <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-danger/20 bg-surface">
                    {preview.errors.slice(0, 30).map((issue, index) => (
                      <div key={`${issue.sheet}-${issue.row}-${issue.field}-${index}`} className="grid grid-cols-[minmax(7rem,0.35fr)_1fr] gap-3 border-b border-border/60 px-3 py-2 text-xs last:border-0">
                        <span className="font-semibold text-danger">{issue.sheet} · row {issue.row}<span className="block font-normal text-fg-subtle">{issue.field}</span></span>
                        <span className="text-fg-muted">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-raised/35 p-4 text-sm text-fg-muted">
            Your project permissions allow Excel export. Import requires project content edit access.
          </div>
        )}

        {error && <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        <DialogFooter>
          {preview?.committed ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              {file && <Button variant="ghost" onClick={reset}><RefreshCw className="h-4 w-4" /> Reset</Button>}
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {canImport && <Button disabled={!preview?.valid || busy !== null} onClick={() => void commitImport()}>{busy === "commit" ? <Spinner /> : <Upload className="h-4 w-4" />} Import validated rows</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
