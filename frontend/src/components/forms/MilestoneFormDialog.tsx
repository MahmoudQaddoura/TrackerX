/** forms/MilestoneFormDialog.tsx — create/edit an ordered delivery milestone. */
import { CalendarRange, Flag, Layers3, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { type MilestonePayload } from "@/api/milestones";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/apiClient";
import { toInputDate } from "@/lib/utils";
import type { Milestone, MilestoneWorkstream, Project } from "@/types";

export function MilestoneFormDialog({
  open,
  onOpenChange,
  milestone,
  project,
  defaultWorkstream = "project",
  sequenceNumber,
  suggestedSortOrder = 0,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: Milestone;
  project: Project;
  defaultWorkstream?: MilestoneWorkstream;
  sequenceNumber: number;
  suggestedSortOrder?: number;
  onSubmit: (payload: MilestonePayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const projectStart = toInputDate(project.start_date) || undefined;
  const projectEnd = toInputDate(project.end_date) || undefined;
  const minDate = projectStart;
  const maxDate = projectEnd;

  useEffect(() => {
    if (open) {
      setTitle(milestone?.title ?? "");
      setDescription(milestone?.description ?? "");
      setStartDate(toInputDate(milestone?.start_date));
      setEndDate(toInputDate(milestone?.end_date));
      setError(null);
    }
  }, [defaultWorkstream, open, milestone]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (!startDate || !endDate) return setError("Add both dates so the milestone can be scheduled and tracked.");
    if (startDate && endDate && startDate > endDate)
      return setError("Start date must be on or before end date.");
    if (minDate && startDate && startDate < minDate)
      return setError(
        `Start date can't be before the project start (${minDate}).`,
      );
    if (maxDate && endDate && endDate > maxDate)
      return setError(`End date can't be after the project end (${maxDate}).`);
    try {
      await onSubmit({
        title: title.trim(),
        description: description || null,
        start_date: startDate || null,
        end_date: endDate || null,
        workstream: milestone?.workstream ?? defaultWorkstream,
        sort_order: milestone?.sort_order ?? suggestedSortOrder,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border bg-accent-soft/45 px-6 py-5 pr-12">
          <DialogTitle>{milestone ? "Edit milestone" : "New milestone"}</DialogTitle>
          <DialogDescription>
            Define one measurable delivery stage. TrackerX opens milestones in sequence as work is completed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <section className="rounded-lg border border-border bg-surface p-4">
              <SectionHeading icon={Flag} title="Milestone outcome" description="Name the result this stage must deliver." />
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="m-title">Title</Label>
                  <Input
                    id="m-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="For example: Requirements approved"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="m-desc">Success criteria</Label>
                  <Textarea
                    id="m-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What must be true before TrackerX marks this stage complete?"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-4">
              <SectionHeading icon={Layers3} title="Delivery sequence" description="This milestone is placed into the project delivery flow automatically." />
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-accent/15 bg-accent-soft/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-fg">Project Delivery</p>
                  <p className="text-xs text-fg-muted">Complete all tasks here to close this milestone and open the next one.</p>
                </div>
                <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-fg">
                  Step {sequenceNumber}
                </span>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-4">
              <SectionHeading icon={CalendarRange} title="Schedule" description="Dates are required to keep risk and delivery status meaningful." />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="m-start">Start date</Label>
                  <Input
                    id="m-start"
                    type="date"
                    min={minDate}
                    max={endDate || maxDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="m-end">Target completion</Label>
                  <Input
                    id="m-end"
                    type="date"
                    min={startDate || minDate}
                    max={maxDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              {(projectStart || projectEnd) && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
                  <span>Project window: {projectStart ?? "Open"} → {projectEnd ?? "Open"}</span>
                  {projectStart && projectEnd && (
                    <button type="button" className="font-semibold text-accent hover:underline" onClick={() => { setStartDate(projectStart); setEndDate(projectEnd); }}>
                      Use project dates
                    </button>
                  )}
                </div>
              )}
            </section>

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
              {isPending && <Spinner />} {milestone ? "Save changes" : "Create milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="font-display text-sm font-semibold text-fg">{title}</h3>
        <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      </div>
    </div>
  );
}
