import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Send,
  Users,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAssignLeaveCoverage, useCoveragePlan } from "@/hooks/useLeaveRequests";
import { getApiErrorMessage } from "@/lib/apiClient";
import { formatDate, TASK_STATUS_LABELS } from "@/lib/utils";
import type { CoverageCandidate, CoverageSeverity, CoverageTask, LeaveRequest } from "@/types";

const SEVERITY_VARIANT: Record<CoverageSeverity, "default" | "warning" | "danger" | "outline"> = {
  critical: "danger",
  high: "warning",
  medium: "default",
  low: "outline",
};

const WORKLOAD_VARIANT: Record<CoverageCandidate["workload_level"], "success" | "warning" | "danger"> = {
  light: "success",
  balanced: "warning",
  high: "danger",
};

export function CoveragePlanningDialog({
  request,
  onClose,
}: {
  request: LeaveRequest | null;
  onClose: () => void;
}) {
  const plan = useCoveragePlan(request?.id ?? null);
  const assignCoverage = useAssignLeaveCoverage();
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [batchCandidate, setBatchCandidate] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [coverageNote, setCoverageNote] = useState("");
  const [autofill, setAutofill] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAssignments({});
    setBatchCandidate("");
    setReviewNote("");
    setCoverageNote("");
    setAutofill(true);
    setError(null);
  }, [request?.id]);

  const eligibleCandidates = useMemo(
    () => (plan.data?.candidates ?? []).filter((candidate) => candidate.eligible),
    [plan.data?.candidates],
  );
  const requiredTasks = useMemo(
    () => (plan.data?.tasks ?? []).filter((task) => task.requires_assignment),
    [plan.data?.tasks],
  );
  const missingRequired = requiredTasks.filter((task) => !assignments[task.id]);

  function assignAllRequired() {
    const candidateId = Number(batchCandidate);
    if (!candidateId) return;
    setAssignments((current) => ({
      ...current,
      ...Object.fromEntries(requiredTasks.map((task) => [task.id, candidateId])),
    }));
  }

  async function submit() {
    if (!request || !plan.data) return;
    if (missingRequired.length) {
      setError(`Assign coverage for the remaining ${missingRequired.length} required task${missingRequired.length === 1 ? "" : "s"}.`);
      return;
    }
    setError(null);
    try {
      await assignCoverage.mutateAsync({
        requestId: request.id,
        payload: {
          assignments: Object.entries(assignments).map(([taskId, memberId]) => ({
            task_id: Number(taskId),
            to_member_id: memberId,
          })),
          review_note: reviewNote.trim() || null,
          coverage_note: coverageNote.trim() || null,
          autofill_attendance: autofill,
        },
      });
      onClose();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not assign coverage and approve this leave."));
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {request?.status === "pending" ? "Assign coverage & approve leave" : "Manage leave coverage"}
          </DialogTitle>
        </DialogHeader>

        {plan.isLoading ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-52" /><Skeleton className="h-64" /></div>
        ) : plan.isError || !plan.data ? (
          <ErrorState message="Could not prepare the task coverage plan." onRetry={() => plan.refetch()} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 rounded-xl border border-accent/20 bg-accent-soft/40 p-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-fg">{plan.data.employee_name}</h3>
                  <Badge variant="default"><CalendarDays className="h-3.5 w-3.5" />{formatDate(plan.data.start_date)} — {formatDate(plan.data.end_date)}</Badge>
                  <Badge variant="outline">{plan.data.tasks.length} active tasks</Badge>
                </div>
                <p className="mt-2 text-sm text-fg-muted">{plan.data.reason}</p>
              </div>
              <div className="rounded-lg bg-surface px-4 py-3 text-center shadow-sm">
                <p className="text-xs text-fg-subtle">Coverage required</p>
                <p className="mt-1 text-xl font-bold text-fg">{requiredTasks.length}</p>
              </div>
            </div>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-fg"><Users className="h-4 w-4 text-accent" />Available employees</h3>
                  <p className="mt-1 text-xs text-fg-muted">Compare current workload, high-severity work, effort, and overlapping leave before assigning.</p>
                </div>
                <div className="flex min-w-72 gap-2">
                  <Select value={batchCandidate} onChange={(event) => setBatchCandidate(event.target.value)}>
                    <option value="">Assign all required tasks to...</option>
                    {eligibleCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.open_task_count} open</option>)}
                  </Select>
                  <Button variant="outline" onClick={assignAllRequired} disabled={!batchCandidate}>Apply</Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plan.data.candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-fg"><ClipboardList className="h-4 w-4 text-accent" />Task distribution</h3>
                  <p className="mt-1 text-xs text-fg-muted">The employee is notified first. Ownership changes only after acceptance.</p>
                </div>
                <Badge variant={missingRequired.length ? "warning" : "success"}>
                  {missingRequired.length ? `${missingRequired.length} assignment${missingRequired.length === 1 ? "" : "s"} remaining` : "Coverage ready"}
                </Badge>
              </div>
              {plan.data.tasks.length ? (
                <div className="space-y-2">
                  {plan.data.tasks.map((task) => (
                    <TaskCoverageRow
                      key={task.id}
                      task={task}
                      candidates={eligibleCandidates}
                      selectedMemberId={assignments[task.id] ?? null}
                      onSelect={(memberId) => setAssignments((current) => {
                        const next = { ...current };
                        if (memberId) next[task.id] = memberId;
                        else delete next[task.id];
                        return next;
                      })}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-success/25 bg-success/5 p-4 text-sm text-fg-muted">
                  <CheckCircle2 className="mr-2 inline h-4 w-4 text-success" />No active tasks require reassignment. This leave can be approved directly.
                </div>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="coverage-note">Message to receiving employees</Label><Textarea id="coverage-note" rows={3} value={coverageNote} onChange={(event) => setCoverageNote(event.target.value)} placeholder="Explain priorities, handover details, or client impact." /></div>
              <div className="space-y-1.5"><Label htmlFor="approval-note">Approval note</Label><Textarea id="approval-note" rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Optional note recorded with the leave approval." /></div>
            </div>
            {request?.status === "pending" && (
              <label className="flex gap-3 rounded-lg border border-border p-3 text-sm text-fg">
                <input type="checkbox" checked={autofill} onChange={(event) => setAutofill(event.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
                <span><span className="flex items-center gap-1 font-medium"><WandSparkles className="h-4 w-4 text-accent" />Autofill attendance after approval</span><span className="mt-1 block text-xs text-fg-muted">Tag the approved leave dates with this request in the attendance sheet.</span></span>
              </label>
            )}
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!plan.data || assignCoverage.isPending || missingRequired.length > 0}>
            {assignCoverage.isPending ? <Spinner /> : request?.status === "pending" ? <Send className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {request?.status === "pending" ? "Send coverage & approve" : "Send coverage requests"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidateCard({ candidate }: { candidate: CoverageCandidate }) {
  return (
    <div className={`rounded-lg border p-3 ${candidate.eligible ? "border-border bg-surface" : "border-border bg-raised/50 opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-medium text-fg">{candidate.name}</p><p className="text-xs text-fg-muted">{candidate.role || "Team member"}</p></div>
        <Badge variant={candidate.eligible ? WORKLOAD_VARIANT[candidate.workload_level] : "outline"}>{candidate.eligible ? `${candidate.workload_level} load` : candidate.availability.replace("_", " ")}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Open" value={candidate.open_task_count} />
        <Metric label="High risk" value={candidate.high_severity_count} />
        <Metric label="Est. days" value={candidate.active_est_days} />
      </div>
      {candidate.availability_note && <p className="mt-2 text-xs text-danger">{candidate.availability_note}</p>}
      {candidate.current_tasks.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium text-accent">View current tasks</summary>
          <div className="mt-2 space-y-1.5">{candidate.current_tasks.map((task) => <div key={task.id} className="rounded-md bg-raised px-2 py-1.5"><div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-fg">{task.title}</span><Badge variant={SEVERITY_VARIANT[task.severity]}>{task.severity}</Badge></div><p className="mt-0.5 truncate text-fg-subtle">{task.project_name}</p></div>)}</div>
        </details>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-raised/70 px-2 py-1.5"><p className="font-semibold text-fg">{value}</p><p className="text-[10px] text-fg-subtle">{label}</p></div>;
}

function TaskCoverageRow({ task, candidates, selectedMemberId, onSelect }: { task: CoverageTask; candidates: CoverageCandidate[]; selectedMemberId: number | null; onSelect: (memberId: number | null) => void }) {
  const activeCoverage = task.coverage_status === "pending" || task.coverage_status === "accepted";
  return (
    <div className={`grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1fr)_280px] ${task.requires_assignment ? "border-warning/35 bg-warning/5" : "border-border bg-surface"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge variant={SEVERITY_VARIANT[task.severity]}>{task.severity}</Badge><p className="font-medium text-fg">{task.title}</p></div>
        <p className="mt-1 text-xs text-fg-muted">{task.project_name} · {task.milestone_name}</p>
        <p className="mt-1 text-xs text-fg-subtle">{TASK_STATUS_LABELS[task.status]} · Due {formatDate(task.due_date)} · {task.est_days ?? "—"} est. days</p>
        {!task.requires_assignment && !activeCoverage && <p className="mt-1 text-xs text-success">Existing co-assignee remains available: {task.current_assignees.join(", ")}</p>}
      </div>
      <div className="self-center">
        {activeCoverage ? (
          <div className="rounded-md border border-border bg-raised px-3 py-2 text-sm"><span className="font-medium text-fg">{task.coverage_assignee_name}</span><span className="ml-2 capitalize text-fg-muted">{task.coverage_status}</span></div>
        ) : (
          <Select value={selectedMemberId ?? ""} onChange={(event) => onSelect(event.target.value ? Number(event.target.value) : null)}>
            <option value="">{task.requires_assignment ? "Select coverage employee..." : "Keep with existing team"}</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.open_task_count} open · {candidate.active_est_days}d</option>)}
          </Select>
        )}
      </div>
    </div>
  );
}
