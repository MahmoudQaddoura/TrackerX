/**
 * forms/TaskFormDialog.tsx
 * Create/edit a task: schedule, status, assignees, estimate, and a delay
 * sub-panel. "Delayed" is an overlay flag independent of status — a task in
 * any column can be flagged, and flagging it requires a cause.
 */
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardList,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { type TaskPayload } from "@/api/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTeam } from "@/hooks/useTeam";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn, TASK_STATUS_LABELS, TASK_STATUS_OPTIONS, toInputDate } from "@/lib/utils";
import type { Milestone, Task, TaskStatus } from "@/types";

const STATUS_BUTTON_STYLES: Record<TaskStatus, string> = {
  todo: "border-border bg-raised text-fg-muted",
  in_progress: "border-accent/30 bg-accent-soft text-accent",
  blocked: "border-danger/25 bg-danger/10 text-danger",
  in_review: "border-warning/30 bg-warning/10 text-warning",
  done: "border-success/25 bg-success/10 text-success",
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  milestone,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  milestone: Milestone;
  onSubmit: (payload: TaskPayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const { data: team } = useTeam(true);
  const { isPm } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estDays, setEstDays] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [isDelayed, setIsDelayed] = useState(false);
  const [delayCause, setDelayCause] = useState("Company");
  const [delayComment, setDelayComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? "todo");
      setStartDate(toInputDate(task?.start_date));
      setEndDate(toInputDate(task?.end_date));
      setEstDays(task?.est_days != null ? String(task.est_days) : "");
      setAssigneeIds(
        task?.assigned_members?.length
          ? task.assigned_members.map((member) => member.id)
          : task?.assigned_member_id != null
            ? [task.assigned_member_id]
            : [],
      );
      setAssigneeSearch("");
      setIsDelayed(task?.is_delayed ?? false);
      setDelayCause(task?.delay_cause ?? "Company");
      setDelayComment(task?.delay_comment ?? "");
      setError(null);
    }
  }, [open, task]);

  const delayed = isDelayed;
  const milestoneStart = toInputDate(milestone.start_date) || undefined;
  const milestoneEnd = toInputDate(milestone.end_date) || undefined;
  const scheduledDays = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return null;
    return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  }, [endDate, startDate]);
  const filteredTeam = useMemo(() => {
    const query = assigneeSearch.trim().toLocaleLowerCase();
    const available = isPm ? (team ?? []).filter((member) => member.assigned_project_ids.includes(milestone.project_id)) : (team ?? []);
    if (!query) return available;
    return available.filter((member) =>
      `${member.name} ${member.role ?? ""}`.toLocaleLowerCase().includes(query),
    );
  }, [assigneeSearch, isPm, milestone.project_id, team]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (startDate && endDate && startDate > endDate)
      return setError("Start date must be on or before end date.");
    if (milestoneStart && startDate && startDate < milestoneStart)
      return setError(`Task start cannot be before the milestone (${milestoneStart}).`);
    if (milestoneEnd && endDate && endDate > milestoneEnd)
      return setError(`Task end cannot be after the milestone (${milestoneEnd}).`);
    if (estDays && Number(estDays) <= 0) return setError("Estimated days must be greater than zero.");
    if (delayed && !delayCause) return setError("A delayed task needs a cause.");
    if (delayed && !delayComment.trim()) return setError("Add a short note explaining the delay.");
    try {
      await onSubmit({
        title: title.trim(),
        description: description || null,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        est_days: estDays ? Number(estDays) : null,
        assigned_member_ids: assigneeIds,
        is_delayed: delayed,
        delay_cause: delayed ? delayCause : null,
        delay_comment: delayed ? delayComment || null : null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b border-border bg-accent-soft/45 px-6 py-5 pr-12">
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {milestone.title} · Keep ownership, timing, and delivery state in one place.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <FormSection icon={ClipboardList} title="Task details" description="Describe the deliverable and choose its current workflow stage.">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t-title">Title</Label>
                <Input
                  id="t-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="A clear, outcome-focused task title"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t-desc">Description</Label>
                <Textarea
                  id="t-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope, acceptance criteria, links, or important context"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-fg">Status</legend>
                <div className="grid gap-2 sm:grid-cols-5">
                  {TASK_STATUS_OPTIONS.map((option) => {
                    const selected = status === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setStatus(option)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition-all",
                          selected
                            ? `${STATUS_BUTTON_STYLES[option]} ring-2 ring-current/15`
                            : "border-border bg-surface text-fg-muted hover:border-accent/30 hover:bg-accent-soft/30",
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {TASK_STATUS_LABELS[option]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </FormSection>

            <FormSection icon={Users} title="Ownership" description="Assign everyone accountable for delivering this task.">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="t-assignee-search">Assignees</Label>
              <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                    {assigneeIds.length} selected
                  </span>
                {assigneeIds.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-accent hover:underline"
                    onClick={() => setAssigneeIds([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  id="t-assignee-search"
                  value={assigneeSearch}
                  onChange={(event) => setAssigneeSearch(event.target.value)}
                  placeholder="Search employees by name or role…"
                  className="pl-9"
                />
              </div>
              <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-border bg-bg/45 p-2 sm:grid-cols-2">
              {filteredTeam.map((member) => {
                const checked = assigneeIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 transition-colors",
                        checked
                          ? "border-accent/30 bg-accent-soft text-accent"
                          : "border-transparent bg-surface hover:border-accent/20 hover:bg-accent-soft/35",
                      )}
                  >
                    <input
                      type="checkbox"
                        className="mt-0.5 accent-[hsl(var(--accent))]"
                      checked={checked}
                      onChange={() =>
                        setAssigneeIds((current) =>
                          checked
                            ? current.filter((id) => id !== member.id)
                            : [...current, member.id],
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{member.name}</span>
                      {member.role && (
                        <span className="block truncate text-xs text-fg-subtle">{member.role}</span>
                      )}
                    </span>
                  </label>
                );
              })}
                {filteredTeam.length === 0 && (
                  <p className="p-3 text-sm text-fg-muted sm:col-span-2">
                    {team?.length === 0 ? "No active team members available." : "No employees match this search."}
                  </p>
              )}
            </div>
            </FormSection>

            <FormSection icon={CalendarDays} title="Schedule" description={`Keep dates inside the milestone window${milestoneStart || milestoneEnd ? ` (${milestoneStart ?? "open"} to ${milestoneEnd ?? "open"})` : ""}.`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-start">Start date</Label>
                  <Input id="t-start" type="date" min={milestoneStart} max={milestoneEnd} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-end">End date</Label>
                  <Input id="t-end" type="date" min={startDate || milestoneStart} max={milestoneEnd} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="t-est">Est. days</Label>
                    {scheduledDays != null && (
                      <button type="button" className="text-[11px] font-semibold text-accent hover:underline" onClick={() => setEstDays(String(scheduledDays))}>
                        Use {scheduledDays}d
                      </button>
                    )}
                  </div>
                  <Input
                    id="t-est"
                    type="number"
                    min="0.5"
                    max="365"
                    step="0.5"
                    value={estDays}
                    onChange={(e) => setEstDays(e.target.value)}
                    placeholder="e.g. 3"
                  />
                </div>
              </div>
            </FormSection>

          {/* Delay sub-panel */}
            <div className={cn("rounded-lg border p-4 transition-colors", delayed ? "border-danger/25 bg-danger/5" : "border-border bg-surface")}>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-fg">
                <span className="flex items-center gap-2">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", delayed ? "bg-danger/10 text-danger" : "bg-raised text-fg-muted")}>
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block">Delivery exception</span>
                    <span className="block text-xs font-normal text-fg-muted">Turn this on only when the task is genuinely delayed.</span>
                  </span>
                </span>
              <input
                type="checkbox"
                  className="accent-[hsl(var(--danger))]"
                checked={delayed}
                onChange={(e) => setIsDelayed(e.target.checked)}
              />
            </label>
            {delayed && (
                <div className="mt-4 grid gap-3 border-t border-danger/15 pt-4 sm:grid-cols-[12rem_1fr]">
                  <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-cause">Delay cause</Label>
                  <Select id="t-cause" value={delayCause} onChange={(e) => setDelayCause(e.target.value)}>
                    <option value="Company">Company</option>
                    <option value="Client">Client</option>
                  </Select>
                </div>
                  <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-dcomment">Delay note</Label>
                  <Textarea
                    id="t-dcomment"
                    value={delayComment}
                    onChange={(e) => setDelayComment(e.target.value)}
                    placeholder="What caused the delay?"
                      required={delayed}
                  />
                </div>
              </div>
            )}
          </div>

            {error && (
              <p role="alert" className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border bg-surface px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />} {task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display text-sm font-semibold text-fg">{title}</h3>
          <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
