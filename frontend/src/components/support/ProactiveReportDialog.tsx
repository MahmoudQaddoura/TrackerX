import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, FileText, Wrench } from "lucide-react";

import type { ProactiveReportPayload } from "@/api/support";
import { AssigneePicker } from "@/components/support/AssigneePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiClient";
import { toInputDate } from "@/lib/utils";
import type {
  ProactiveReportCategory,
  ProactiveReportStatus,
  ProactiveServiceReport,
} from "@/types";

export const PROACTIVE_CATEGORY_OPTIONS: {
  value: ProactiveReportCategory;
  label: string;
  description: string;
}[] = [
  { value: "health_check", label: "Health Check", description: "Availability, backups, capacity, logs, and system health." },
  { value: "patch_update", label: "Patch Update", description: "Security and platform patch review, testing, and deployment." },
  { value: "penetration_testing", label: "Penetration Testing", description: "Security testing, findings, remediation, and retesting." },
  { value: "updates", label: "Updates", description: "Application, configuration, dependency, and service updates." },
  { value: "performance", label: "Performance", description: "Response time, throughput, resource use, and optimization." },
  { value: "kpi", label: "KPI", description: "SLA measures, operational targets, trends, and exceptions." },
];

const STATUS_OPTIONS: { value: ProactiveReportStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "attention_required", label: "Attention Required" },
  { value: "completed", label: "Completed" },
];

export function ProactiveReportDialog({
  open,
  onOpenChange,
  report,
  readOnly = false,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: ProactiveServiceReport;
  readOnly?: boolean;
  isPending?: boolean;
  onSubmit: (payload: ProactiveReportPayload) => Promise<unknown>;
}) {
  const { canManage } = useAuth();
  const [category, setCategory] = useState<ProactiveReportCategory>("health_check");
  const [isCustomService, setIsCustomService] = useState(false);
  const [customService, setCustomService] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ProactiveReportStatus>("pending");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(report?.category ?? "health_check");
    setIsCustomService(!!report?.service_area_name);
    setCustomService(report?.service_area_name ?? "");
    setTitle(report?.title ?? "Health Check Report");
    setStatus(report?.status ?? "pending");
    setPeriodStart(toInputDate(report?.period_start));
    setPeriodEnd(toInputDate(report?.period_end));
    setDueDate(toInputDate(report?.due_date));
    setSummary(report?.executive_summary ?? "");
    setFindings(report?.findings ?? "");
    setWorkCompleted(report?.work_completed ?? "");
    setRecommendations(report?.recommendations ?? "");
    setNextActionDate(toInputDate(report?.next_action_date));
    setAssigneeIds(report?.assigned_members.map((member) => member.id) ?? []);
    setError(null);
  }, [open, report]);

  function changeCategory(value: ProactiveReportCategory | "custom") {
    if (value === "custom") {
      setIsCustomService(true);
      setCategory("updates");
      setCustomService((current) => current || "Custom Service");
      if (!report) setTitle("Custom Service Report");
      return;
    }
    setIsCustomService(false);
    setCustomService("");
    setCategory(value);
    if (!report) {
      const label = PROACTIVE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label;
      setTitle(`${label ?? "Service"} Report`);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Report title is required.");
    if (isCustomService && !customService.trim()) return setError("Custom service name is required.");
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return setError("Reporting period start must be before its end.");
    }
    if (
      status === "completed" &&
      (!summary.trim() || !findings.trim() || !workCompleted.trim() || !recommendations.trim())
    ) {
      return setError(
        "A completed report needs a summary, findings, completed work, and recommendations.",
      );
    }
    try {
      const payload: ProactiveReportPayload = {
        category,
        service_area_name: isCustomService ? customService.trim() : null,
        title: title.trim(),
        status,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        due_date: dueDate || null,
        executive_summary: summary.trim() || null,
        findings: findings.trim() || null,
        work_completed: workCompleted.trim() || null,
        recommendations: recommendations.trim() || null,
        next_action_date: nextActionDate || null,
      };
      if (canManage) payload.assigned_member_ids = assigneeIds;
      await onSubmit(payload);
      onOpenChange(false);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    }
  }

  const categoryDescription = PROACTIVE_CATEGORY_OPTIONS.find(
    (option) => option.value === category,
  )?.description;
  const completedFields = [summary, findings, workCompleted, recommendations].filter((value) => value.trim()).length;
  const completeness = Math.round((completedFields / 4) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report ? "Service assurance report" : "New proactive report"}</DialogTitle>
          <div className="mt-3 rounded-lg border border-accent/20 bg-accent-soft/50 p-3">
            <div className="flex items-center justify-between text-xs"><span className="font-medium text-fg">Report readiness</span><span className="font-semibold text-accent">{completeness}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completeness}%` }} /></div>
            <p className="mt-2 text-xs text-fg-muted">Complete all four report sections before marking the report completed.</p>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <section className="rounded-lg border border-border bg-raised/35 p-4">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-fg">Service and schedule</h3>
              {report && <Badge variant="outline">#{report.id}</Badge>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-category">Service area</Label>
                <Select
                  id="pr-category"
                  value={isCustomService ? "custom" : category}
                  onChange={(event) => changeCategory(event.target.value as ProactiveReportCategory | "custom")}
                  disabled={readOnly || (!canManage && !!report)}
                >
                  {PROACTIVE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                  <option value="custom">Custom service</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-status">Report status</Label>
                <Select
                  id="pr-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProactiveReportStatus)}
                  disabled={readOnly}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              {isCustomService && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="pr-custom-service"><Wrench className="mr-1 inline h-3.5 w-3.5" />Custom service name</Label>
                  <Input id="pr-custom-service" value={customService} onChange={(event) => setCustomService(event.target.value)} placeholder="For example: Database continuity review" disabled={readOnly || (!canManage && !!report)} required />
                  <p className="text-xs text-fg-muted">Use a specific, reusable service name that clients will understand.</p>
                </div>
              )}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="pr-title">Report title</Label>
                <Input
                  id="pr-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={readOnly || (!canManage && !!report)}
                  required
                />
                <p className="text-xs text-fg-muted">{isCustomService ? "Define a service-specific assurance report for this project." : categoryDescription}</p>
              </div>
              <DateField id="pr-start" label="Period start" value={periodStart} onChange={setPeriodStart} disabled={readOnly} />
              <DateField id="pr-end" label="Period end" value={periodEnd} onChange={setPeriodEnd} disabled={readOnly} />
              <DateField id="pr-due" label="Due date" value={dueDate} onChange={setDueDate} disabled={readOnly} />
              <DateField id="pr-next" label="Next action date" value={nextActionDate} onChange={setNextActionDate} disabled={readOnly} />
            </div>
          </section>

          <AssigneePicker selectedIds={assigneeIds} onChange={setAssigneeIds} disabled={readOnly || !canManage} />

          <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-fg">Report sections</h3>
              <Badge variant={completeness === 100 ? "success" : "neutral"}>{completedFields}/4 complete</Badge>
            </div>
            <ReportField id="pr-summary" label="Executive summary" value={summary} onChange={setSummary} placeholder="Summarize the service condition, outcome, and business impact." disabled={readOnly} />
            <ReportField id="pr-findings" label="Findings and evidence" value={findings} onChange={setFindings} placeholder="Document observations, measurements, exceptions, and supporting evidence." disabled={readOnly} />
            <ReportField id="pr-work" label="Work completed" value={workCompleted} onChange={setWorkCompleted} placeholder="Describe checks performed, changes applied, validation, and results." disabled={readOnly} />
            <ReportField id="pr-recommendations" label="Recommendations" value={recommendations} onChange={setRecommendations} placeholder="List prioritized recommendations, owners, and expected outcomes." disabled={readOnly} />
          </section>

          {status === "completed" && completeness === 100 && <div className="flex items-start gap-2 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>This report is ready for PDF download and client forwarding.</span></div>}

          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={isPending}>
                {isPending && <Spinner />} Save report
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DateField({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </div>
  );
}

function ReportField({ id, label, value, onChange, placeholder, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} disabled={disabled} />
    </div>
  );
}
