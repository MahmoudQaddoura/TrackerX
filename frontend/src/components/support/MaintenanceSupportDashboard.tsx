import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileOutput,
  FileText,
  Gauge,
  LifeBuoy,
  Link2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ProjectStatusBadge } from "@/components/common/StatusBadge";
import { AssetInventoryWorkspace } from "@/components/assets/AssetInventoryWorkspace";
import { DocumentRepository } from "@/components/documents/DocumentRepository";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { IncidentDialog } from "@/components/support/IncidentDialog";
import { ForwardReportDialog } from "@/components/support/ForwardReportDialog";
import {
  PROACTIVE_CATEGORY_OPTIONS,
  ProactiveReportDialog,
} from "@/components/support/ProactiveReportDialog";
import { SupportRecordPreview } from "@/components/support/SupportRecordPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { exportProactiveReportPdf } from "@/api/support";
import { useClients, useClientMutations } from "@/hooks/useClients";
import {
  useProactiveReports,
  useSupportIncidents,
  useSupportMutations,
} from "@/hooks/useSupport";
import { formatDate } from "@/lib/utils";
import type {
  ProactiveReportCategory,
  ProactiveReportStatus,
  ProactiveServiceReport,
  Project,
  SupportIncident,
  SupportIncidentSeverity,
  SupportIncidentStatus,
} from "@/types";

const CATEGORY_ICONS: Record<ProactiveReportCategory, LucideIcon> = {
  health_check: Activity,
  patch_update: PackageCheck,
  penetration_testing: ShieldCheck,
  updates: RefreshCw,
  performance: Gauge,
  kpi: BarChart3,
};

export function MaintenanceSupportDashboard({
  project,
  onEditProject,
  onDeleteProject,
}: {
  project: Project;
  onEditProject: () => void;
  onDeleteProject: () => void;
}) {
  const navigate = useNavigate();
  const { isAdmin, canManage, canEditProjectContent } = useAuth();
  const reports = useProactiveReports(project.id);
  const incidents = useSupportIncidents(project.id);
  const mutations = useSupportMutations(project.id);
  const clients = useClients(isAdmin);
  const clientMutations = useClientMutations();
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ProactiveServiceReport | undefined>();
  const [editingIncident, setEditingIncident] = useState<SupportIncident | undefined>();
  const [previewReport, setPreviewReport] = useState<ProactiveServiceReport | undefined>();
  const [previewIncident, setPreviewIncident] = useState<SupportIncident | undefined>();
  const [forwardReport, setForwardReport] = useState<ProactiveServiceReport | undefined>();
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "report"; item: ProactiveServiceReport } | { type: "incident"; item: SupportIncident } | null
  >(null);

  const reportMetrics = useMemo(() => {
    const rows = reports.data ?? [];
    return {
      total: rows.length,
      completed: rows.filter((report) => report.status === "completed").length,
      attention: rows.filter((report) => report.status === "attention_required").length,
      inProgress: rows.filter((report) => report.status === "in_progress").length,
    };
  }, [reports.data]);

  const incidentMetrics = useMemo(() => {
    const rows = incidents.data ?? [];
    const responseHours = rows
      .filter((incident) => incident.response_at)
      .map((incident) => responseDurationHours(incident.reported_at, incident.response_at!))
      .filter((hours) => hours >= 0);
    return {
      open: rows.filter((incident) => !["resolved", "unresolved"].includes(incident.status)).length,
      critical: rows.filter(
        (incident) => incident.severity === "critical" && incident.status !== "resolved",
      ).length,
      resolved: rows.filter((incident) => incident.status === "resolved").length,
      averageResponse:
        responseHours.length > 0
          ? Math.round((responseHours.reduce((total, hours) => total + hours, 0) / responseHours.length) * 10) / 10
          : null,
    };
  }, [incidents.data]);

  const isLoading = reports.isLoading || incidents.isLoading;
  const isError = reports.isError || incidents.isError;

  async function downloadReport(report: ProactiveServiceReport) {
    setDownloadingReportId(report.id);
    try {
      const blob = await exportProactiveReportPdf(report.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `service-report-${String(report.id).padStart(4, "0")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingReportId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" /> Projects
        </Button>
      </div>

      <header className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="bg-gradient-to-br from-accent via-accent to-accent-hover px-5 py-6 text-accent-fg sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <LifeBuoy className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold">{project.name}</h1>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                    Maintenance &amp; Support
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-white/80">
                  {project.description || "Structured service assurance, incident response, and operational evidence."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/75">
                  {project.parent_project_id ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium text-white hover:underline"
                      onClick={() => navigate(`/projects/${project.parent_project_id}`)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Linked to {project.parent_project_name ?? "actual project"}
                    </button>
                  ) : (
                    <span>Standalone support workspace</span>
                  )}
                  <span>{formatDate(project.start_date)} → {formatDate(project.end_date)}</span>
                </div>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2" data-no-print>
                <Button size="sm" variant="subtle" onClick={onEditProject}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="subtle" onClick={onDeleteProject}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-7">
          <ProjectStatusBadge status={project.status} />
          <Badge variant={project.project_manager_name ? "success" : "warning"}>
            <UserRoundCheck className="h-3.5 w-3.5" />
            PM: {project.project_manager_name ?? "Not assigned"}
          </Badge>
          <span className="text-xs text-fg-muted">
            {reportMetrics.completed}/{reportMetrics.total} proactive reports completed
          </span>
          <span className="h-4 w-px bg-border" />
          <span className="text-xs text-fg-muted">{incidentMetrics.open} open incidents</span>
        </div>
      </header>

      {isLoading && <Skeleton className="h-96 w-full" />}
      {isError && (
        <ErrorState
          message="Could not load the Maintenance & Support dashboard."
          onRetry={() => {
            reports.refetch();
            incidents.refetch();
          }}
        />
      )}

      {!isLoading && !isError && (
        <Tabs defaultValue="proactive">
          <TabsList className="grid w-full grid-cols-2 sm:max-w-4xl sm:grid-cols-4">
            <TabsTrigger value="proactive" className="justify-center gap-2 py-2.5">
              <Activity className="h-4 w-4" /> Proactive Tasks
              <Badge variant="neutral">{reportMetrics.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="reactive" className="justify-center gap-2 py-2.5">
              <AlertTriangle className="h-4 w-4" /> Reactive Tasks
              <Badge variant="neutral">{incidents.data?.length ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="assets" className="justify-center gap-2 py-2.5">
              <Boxes className="h-4 w-4" /> Asset Inventory
            </TabsTrigger>
            <TabsTrigger value="documents" className="justify-center gap-2 py-2.5">
              <FileText className="h-4 w-4" /> Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proactive">
            <ProactiveWorkspace
              reports={reports.data ?? []}
              metrics={reportMetrics}
              canEdit={canEditProjectContent}
              canManage={canManage}
              canForward={isAdmin}
              onAdd={() => {
                setEditingReport(undefined);
                setReportOpen(true);
              }}
              onOpen={(report) => {
                setEditingReport(report);
                setReportOpen(true);
              }}
              onPreview={setPreviewReport}
              onDownload={downloadReport}
              onForward={setForwardReport}
              downloadingReportId={downloadingReportId}
              onDelete={(report) => setDeleteTarget({ type: "report", item: report })}
            />
          </TabsContent>

          <TabsContent value="reactive">
            <ReactiveWorkspace
              incidents={incidents.data ?? []}
              metrics={incidentMetrics}
              canEdit={canEditProjectContent}
              canManage={canManage}
              onAdd={() => {
                setEditingIncident(undefined);
                setIncidentOpen(true);
              }}
              onOpen={(incident) => {
                setEditingIncident(incident);
                setIncidentOpen(true);
              }}
              onPreview={setPreviewIncident}
              onDelete={(incident) => setDeleteTarget({ type: "incident", item: incident })}
            />
          </TabsContent>

          <TabsContent value="assets">
            <AssetInventoryWorkspace
              projectId={project.id}
              canEdit={canEditProjectContent}
            />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentRepository projectId={project.id} workspace="support" embedded />
          </TabsContent>
        </Tabs>
      )}

      <ProactiveReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        report={editingReport}
        readOnly={!canEditProjectContent}
        isPending={mutations.createReport.isPending || mutations.updateReport.isPending}
        onSubmit={(payload) =>
          editingReport
            ? mutations.updateReport.mutateAsync({ id: editingReport.id, payload })
            : mutations.createReport.mutateAsync(payload)
        }
      />
      <IncidentDialog
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        incident={editingIncident}
        readOnly={!canEditProjectContent}
        isPending={mutations.createIncident.isPending || mutations.updateIncident.isPending}
        onSubmit={(payload) =>
          editingIncident
            ? mutations.updateIncident.mutateAsync({ id: editingIncident.id, payload })
            : mutations.createIncident.mutateAsync(payload)
        }
      />
      <SupportRecordPreview
        open={!!previewReport || !!previewIncident}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewReport(undefined);
            setPreviewIncident(undefined);
          }
        }}
        project={project}
        report={previewReport}
        incident={previewIncident}
        isDownloading={!!previewReport && downloadingReportId === previewReport.id}
        onDownload={previewReport ? () => downloadReport(previewReport) : undefined}
      />
      <ForwardReportDialog open={!!forwardReport} onOpenChange={(open) => !open && setForwardReport(undefined)} project={project} report={forwardReport} clients={clients.data ?? []} isPending={clientMutations.forwardReport.isPending} onForward={(clientId, message) => clientMutations.forwardReport.mutateAsync({ clientId, reportType: "proactive", reportId: forwardReport!.id, message })} />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === "incident" ? "Delete incident" : "Delete proactive report"}
        description={`Delete "${deleteTarget?.item.title ?? "this record"}"?`}
        isPending={mutations.deleteReport.isPending || mutations.deleteIncident.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "report") {
            mutations.deleteReport.mutate(deleteTarget.item.id, { onSuccess: () => setDeleteTarget(null) });
          } else {
            mutations.deleteIncident.mutate(deleteTarget.item.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
      />
    </div>
  );
}

function ProactiveWorkspace({
  reports,
  metrics,
  canEdit,
  canManage,
  canForward,
  onAdd,
  onOpen,
  onPreview,
  onDownload,
  onForward,
  downloadingReportId,
  onDelete,
}: {
  reports: ProactiveServiceReport[];
  metrics: { total: number; completed: number; attention: number; inProgress: number };
  canEdit: boolean;
  canManage: boolean;
  canForward: boolean;
  onAdd: () => void;
  onOpen: (report: ProactiveServiceReport) => void;
  onPreview: (report: ProactiveServiceReport) => void;
  onDownload: (report: ProactiveServiceReport) => void;
  onForward: (report: ProactiveServiceReport) => void;
  downloadingReportId: number | null;
  onDelete: (report: ProactiveServiceReport) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Completed reports" value={metrics.completed} icon={CheckCircle2} tone="success" />
        <MetricCard label="In progress" value={metrics.inProgress} icon={Clock3} />
        <MetricCard label="Attention required" value={metrics.attention} icon={AlertTriangle} tone="warning" />
        <MetricCard label="Service areas" value={new Set(reports.map((report) => report.service_area_name || report.category)).size} icon={Activity} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Service assurance reports</h2>
          <p className="mt-1 max-w-3xl text-sm text-fg-muted">
            Complete structured service evidence, download a client-ready PDF, and forward finalized reports to the linked client portal.
          </p>
        </div>
        {canEdit && <Button onClick={onAdd}><Plus className="h-4 w-4" /> New report</Button>}
      </div>

      {reports.length === 0 ? (
        <EmptyState icon={Activity} title="No proactive reports" description={canEdit ? "Create the first service assurance report." : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <ProactiveReportCard
              key={report.id}
              report={report}
              canEdit={canEdit}
              canManage={canManage}
              canForward={canForward}
              onOpen={() => onOpen(report)}
              onPreview={() => onPreview(report)}
              onDownload={() => onDownload(report)}
              onForward={() => onForward(report)}
              isDownloading={downloadingReportId === report.id}
              onDelete={() => onDelete(report)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProactiveReportCard({ report, canEdit, canManage, canForward, onOpen, onPreview, onDownload, onForward, onDelete, isDownloading }: { report: ProactiveServiceReport; canEdit: boolean; canManage: boolean; canForward: boolean; onOpen: () => void; onPreview: () => void; onDownload: () => void; onForward: () => void; onDelete: () => void; isDownloading: boolean }) {
  const Icon = CATEGORY_ICONS[report.category];
  const category = PROACTIVE_CATEGORY_OPTIONS.find((option) => option.value === report.category);
  const serviceLabel = report.service_area_name || category?.label;
  const completeness = reportCompleteness(report);
  return (
    <Card className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md" onClick={onOpen}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon className="h-5 w-5" /></span>
          <ReportStatusBadge status={report.status} />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">{serviceLabel}</p>
        <h3 className="mt-1 font-semibold text-fg">{report.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-muted">{report.service_area_name ? "Custom service assurance report." : category?.description}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-fg-muted"><span>Report completeness</span><span>{completeness}%</span></div>
        <Progress value={completeness} className="mt-1.5" />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {report.assigned_members.length ? report.assigned_members.slice(0, 2).map((member) => <Badge key={member.id} variant="neutral"><UserRoundCheck className="h-3 w-3" /> {member.name}</Badge>) : <Badge variant="neutral">Unassigned</Badge>}
          {report.assigned_members.length > 2 && <Badge variant="outline">+{report.assigned_members.length - 2}</Badge>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3" onClick={(event) => event.stopPropagation()}>
          <span className="text-xs text-fg-subtle">Updated {formatDate(report.updated_at)}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" title="Preview report" aria-label="Preview report" onClick={onPreview}><FileOutput className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Download PDF" aria-label="Download report PDF" disabled={isDownloading} onClick={onDownload}><Download className="h-4 w-4" /></Button>
            {canForward && report.status === "completed" && <Button variant="ghost" size="icon" title="Forward to client" aria-label="Forward report to client" onClick={onForward}><Send className="h-4 w-4" /></Button>}
            {canEdit && <Button variant="ghost" size="icon" title="Edit report" aria-label="Edit report" onClick={onOpen}><Pencil className="h-4 w-4" /></Button>}
            {canManage && <Button variant="ghost" size="icon" title="Delete report" aria-label="Delete report" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReactiveWorkspace({ incidents, metrics, canEdit, canManage, onAdd, onOpen, onPreview, onDelete }: { incidents: SupportIncident[]; metrics: { open: number; critical: number; resolved: number; averageResponse: number | null }; canEdit: boolean; canManage: boolean; onAdd: () => void; onOpen: (incident: SupportIncident) => void; onPreview: (incident: SupportIncident) => void; onDelete: (incident: SupportIncident) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open incidents" value={metrics.open} icon={AlertTriangle} tone={metrics.open ? "warning" : "default"} />
        <MetricCard label="Critical open" value={metrics.critical} icon={AlertTriangle} tone={metrics.critical ? "danger" : "default"} />
        <MetricCard label="Resolved" value={metrics.resolved} icon={CheckCircle2} tone="success" />
        <MetricCard label="Average response" value={metrics.averageResponse == null ? "—" : `${metrics.averageResponse}h`} icon={Clock3} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Incident and response register</h2>
          <p className="mt-1 max-w-3xl text-sm text-fg-muted">Capture the client report, reason, impact, response method, investigation, timing, and final resolution in one accountable record.</p>
        </div>
        {canEdit && <Button onClick={onAdd}><Plus className="h-4 w-4" /> Report incident</Button>}
      </div>
      {incidents.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No incidents reported" description="Reactive incidents will be recorded here when support is required." />
      ) : (
        <div className="flex flex-col gap-3">
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} canEdit={canEdit} canManage={canManage} onOpen={() => onOpen(incident)} onPreview={() => onPreview(incident)} onDelete={() => onDelete(incident)} />
          ))}
        </div>
      )}
    </div>
  );
}

function IncidentCard({ incident, canEdit, canManage, onOpen, onPreview, onDelete }: { incident: SupportIncident; canEdit: boolean; canManage: boolean; onOpen: () => void; onPreview: () => void; onDelete: () => void }) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-accent/60" onClick={onOpen}>
      <CardContent className="grid gap-4 pt-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-danger/10 text-danger"><AlertTriangle className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-fg">{incident.title}</h3><SeverityBadge severity={incident.severity} /><IncidentStatusBadge status={incident.status} /></div>
          <p className="mt-1 line-clamp-1 text-sm text-fg-muted">{incident.client_report || incident.description || "No client report recorded."}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-subtle"><span>Reported {formatDateTime(incident.reported_at)}</span><span>Response {incident.response_at ? formatDateTime(incident.response_at) : "not recorded"}</span><span>{incident.assigned_members.length ? incident.assigned_members.map((member) => member.name).join(", ") : "Unassigned"}</span></div>
        </div>
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={onPreview}><FileOutput className="h-4 w-4" /> Report</Button>
          {canEdit && <Button variant="ghost" size="icon" aria-label="Edit incident" onClick={onOpen}><Pencil className="h-4 w-4" /></Button>}
          {canManage && <Button variant="ghost" size="icon" aria-label="Delete incident" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, icon: Icon, tone = "default" }: { label: string; value: string | number; icon: LucideIcon; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = { default: "bg-accent-soft text-accent", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", danger: "bg-danger/10 text-danger" }[tone];
  return <Card><CardContent className="flex items-center justify-between gap-3 pt-5"><div><p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p><p className="mt-1 font-display text-2xl font-bold text-fg">{value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-5 w-5" /></span></CardContent></Card>;
}

function ReportStatusBadge({ status }: { status: ProactiveReportStatus }) {
  const labels: Record<ProactiveReportStatus, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed", attention_required: "Attention Required" };
  const variants: Record<ProactiveReportStatus, "neutral" | "default" | "success" | "warning"> = { pending: "neutral", in_progress: "default", completed: "success", attention_required: "warning" };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function IncidentStatusBadge({ status }: { status: SupportIncidentStatus }) {
  const labels: Record<SupportIncidentStatus, string> = { reported: "Reported", investigating: "Investigating", resolved: "Resolved", unresolved: "Not Resolved" };
  const variants: Record<SupportIncidentStatus, "neutral" | "default" | "success" | "danger"> = { reported: "neutral", investigating: "default", resolved: "success", unresolved: "danger" };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function SeverityBadge({ severity }: { severity: SupportIncidentSeverity }) {
  const variants: Record<SupportIncidentSeverity, "neutral" | "default" | "warning" | "danger"> = { low: "neutral", medium: "default", high: "warning", critical: "danger" };
  return <Badge variant={variants[severity]}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Badge>;
}

function reportCompleteness(report: ProactiveServiceReport): number {
  const fields = [report.period_start, report.period_end, report.executive_summary, report.findings, report.work_completed, report.recommendations, report.next_action_date, report.assigned_members.length ? "assigned" : null];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function responseDurationHours(reportedAt: string, responseAt: string): number {
  return (new Date(responseAt).getTime() - new Date(reportedAt).getTime()) / 3_600_000;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
