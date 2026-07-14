/** forms/MilestoneFormDialog.tsx — create/edit a milestone (dates clamp to project). */
import { FormEvent, useEffect, useState } from "react";

import { type MilestonePayload } from "@/api/milestones";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/apiClient";
import { toInputDate } from "@/lib/utils";
import type { Milestone, Project } from "@/types";

export function MilestoneFormDialog({
  open,
  onOpenChange,
  milestone,
  project,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: Milestone;
  project: Project;
  onSubmit: (payload: MilestonePayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const minDate = toInputDate(project.start_date) || undefined;
  const maxDate = toInputDate(project.end_date) || undefined;

  useEffect(() => {
    if (open) {
      setTitle(milestone?.title ?? "");
      setDescription(milestone?.description ?? "");
      setStartDate(toInputDate(milestone?.start_date));
      setEndDate(toInputDate(milestone?.end_date));
      setError(null);
    }
  }, [open, milestone]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (startDate && endDate && startDate > endDate)
      return setError("Start date must be on or before end date.");
    if (minDate && startDate && startDate < minDate)
      return setError(`Start date can't be before the project start (${minDate}).`);
    if (maxDate && endDate && endDate > maxDate)
      return setError(`End date can't be after the project end (${maxDate}).`);
    try {
      await onSubmit({
        title: title.trim(),
        description: description || null,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit milestone" : "New milestone"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-start">Start date</Label>
              <Input
                id="m-start"
                type="date"
                min={minDate}
                max={maxDate}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-end">End date</Label>
              <Input
                id="m-end"
                type="date"
                min={minDate}
                max={maxDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
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
