/**
 * forms/TaskFormDialog.tsx
 * Create/edit a task: schedule, status, assignees, estimate, and a delay
 * sub-panel. "Delayed" is an overlay flag independent of status — a task in
 * any column can be flagged, and flagging it requires a cause.
 */
import { FormEvent, useEffect, useState } from "react";

import { type TaskPayload } from "@/api/tasks";
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
import { useTeam } from "@/hooks/useTeam";
import { getApiErrorMessage } from "@/lib/apiClient";
import { TASK_STATUS_LABELS, TASK_STATUS_OPTIONS, toInputDate } from "@/lib/utils";
import type { Task } from "@/types";

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  onSubmit: (payload: TaskPayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const { data: team } = useTeam(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estDays, setEstDays] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
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
      setIsDelayed(task?.is_delayed ?? false);
      setDelayCause(task?.delay_cause ?? "Company");
      setDelayComment(task?.delay_comment ?? "");
      setError(null);
    }
  }, [open, task]);

  const delayed = isDelayed;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (startDate && endDate && startDate > endDate)
      return setError("Start date must be on or before end date.");
    if (delayed && !delayCause) return setError("A delayed task needs a cause.");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="t-status">Status</Label>
            <Select id="t-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {TASK_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label>Assignees</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-muted">
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
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-border bg-input p-2 sm:grid-cols-2">
              {(team ?? []).map((member) => {
                const checked = assigneeIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors ${
                      checked
                        ? "border-accent bg-accent-soft"
                        : "border-transparent hover:border-border hover:bg-raised"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
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
              {team?.length === 0 && (
                <p className="p-2 text-sm text-fg-muted">No active team members available.</p>
              )}
            </div>
            <p className="text-xs text-fg-muted">Select everyone responsible for delivering this task.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-start">Start</Label>
              <Input id="t-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-end">End</Label>
              <Input id="t-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-est">Est. days</Label>
              <Input
                id="t-est"
                type="number"
                min="0"
                step="0.5"
                value={estDays}
                onChange={(e) => setEstDays(e.target.value)}
              />
            </div>
          </div>

          {/* Delay sub-panel */}
          <div className="rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-fg">
              <input
                type="checkbox"
                checked={delayed}
                onChange={(e) => setIsDelayed(e.target.checked)}
              />
              Mark as delayed
            </label>
            {delayed && (
              <div className="mt-3 flex flex-col gap-3">
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
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
