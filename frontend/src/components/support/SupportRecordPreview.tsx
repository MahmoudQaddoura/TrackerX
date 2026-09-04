import { FileDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { ProactiveServiceReport, Project, SupportIncident } from "@/types";

export function SupportRecordPreview({
  open,
  onOpenChange,
  project,
  report,
  incident,
  onDownload,
  isDownloading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  report?: ProactiveServiceReport;
  incident?: SupportIncident;
  onDownload?: () => void;
  isDownloading?: boolean;
}) {
  if (!report && !incident) return null;
  const title = report?.title ?? incident?.title ?? "Service report";
  const reference = report
    ? `PR-${String(report.id).padStart(4, "0")}`
    : `INC-${String(incident!.id).padStart(4, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <div data-support-print-area className="bg-surface p-1 sm:p-5">
          <DialogHeader>
            <div className="border-b-2 border-accent pb-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    TrackerX · Maintenance &amp; Support
                  </p>
                  <DialogTitle className="mt-2 text-2xl">{title}</DialogTitle>
                  <p className="mt-1 text-sm text-fg-muted">{project.name}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-fg">{reference}</p>
                  <p className="text-fg-muted">Generated {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {report ? <ProactiveReportBody report={report} /> : <IncidentReportBody incident={incident!} />}

          <div className="mt-8 border-t border-border pt-4 text-xs text-fg-subtle">
            Generated from TrackerX. Validate sensitive or client-facing content before distribution.
          </div>
        </div>

        <DialogFooter data-no-print>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {report && onDownload && <Button onClick={onDownload} disabled={isDownloading}>
            {isDownloading ? <Spinner /> : <FileDown className="h-4 w-4" />} Download PDF
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProactiveReportBody({ report }: { report: ProactiveServiceReport }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <ReportMeta label="Status" value={report.status.replace(/_/g, " ")} />
        <ReportMeta label="Period start" value={formatDate(report.period_start)} />
        <ReportMeta label="Period end" value={formatDate(report.period_end)} />
        <ReportMeta label="Next action" value={formatDate(report.next_action_date)} />
      </div>
      <ReportSection title="Executive summary" value={report.executive_summary} />
      <ReportSection title="Findings and evidence" value={report.findings} />
      <ReportSection title="Work completed" value={report.work_completed} />
      <ReportSection title="Recommendations" value={report.recommendations} />
      <AssigneeLine names={report.assigned_members.map((member) => member.name)} />
    </div>
  );
}

function IncidentReportBody({ incident }: { incident: SupportIncident }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <ReportMeta label="Status" value={incident.status.replace(/_/g, " ")} />
        <ReportMeta label="Severity" value={incident.severity} />
        <ReportMeta label="Time reported" value={formatDateTime(incident.reported_at)} />
        <ReportMeta label="Response time" value={formatDateTime(incident.response_at)} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <ReportSection title="Client report" value={incident.client_report} />
        <ReportSection title="Reason / suspected cause" value={incident.reason} />
      </div>
      <ReportSection title="Description and impact" value={incident.description} />
      <ReportSection title="Recommended method" value={incident.recommendation} />
      <div className="border-t border-border pt-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-fg">Investigation and response</h3>
        <div className="flex flex-col gap-6">
          <ReportSection title="Investigation" value={incident.investigation} />
          <ReportSection title="Response description" value={incident.response_description} />
          <ReportSection title="Resolution / unresolved notes" value={incident.resolution_notes} />
        </div>
      </div>
      <AssigneeLine names={incident.assigned_members.map((member) => member.name)} />
    </div>
  );
}

function ReportMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-raised/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize text-fg">{value || "Not recorded"}</p>
    </div>
  );
}

function ReportSection({ title, value }: { title: string; value: string | null }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-fg">
        {value || "Not recorded."}
      </p>
    </section>
  );
}

function AssigneeLine({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <span className="text-sm font-medium text-fg">Assigned employees</span>
      {names.length ? names.map((name) => <Badge key={name} variant="neutral">{name}</Badge>) : <span className="text-sm text-fg-muted">Unassigned</span>}
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
