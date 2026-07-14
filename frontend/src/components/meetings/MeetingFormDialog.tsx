/** meetings/MeetingFormDialog.tsx — create/edit meeting minutes. */
import { FormEvent, useEffect, useState } from "react";

import { type MeetingPayload } from "@/api/meetings";
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
import { getApiErrorMessage } from "@/lib/apiClient";
import { toInputDate } from "@/lib/utils";
import type { Meeting } from "@/types";

export function MeetingFormDialog({
  open,
  onOpenChange,
  meeting,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: Meeting;
  onSubmit: (payload: MeetingPayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const [meetingType, setMeetingType] = useState("sprint");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMeetingType(meeting?.meeting_type ?? "sprint");
      setTitle(meeting?.title ?? "");
      setMeetingDate(toInputDate(meeting?.meeting_date) || new Date().toISOString().slice(0, 10));
      setDiscussion(meeting?.discussion_points ?? "");
      setOutcome(meeting?.outcome ?? "");
      setError(null);
    }
  }, [open, meeting]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (!meetingDate) return setError("Date is required.");
    try {
      await onSubmit({
        meeting_type: meetingType,
        title: title.trim(),
        meeting_date: meetingDate,
        discussion_points: discussion || null,
        outcome: outcome || null,
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
          <DialogTitle>{meeting ? "Edit meeting" : "New meeting"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-type">Type</Label>
              <Select id="mt-type" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
                <option value="sprint">Sprint</option>
                <option value="client">Client</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-date">Date</Label>
              <Input id="mt-date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mt-title">Title</Label>
            <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sprint 5 Review" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mt-disc">Discussion / notes</Label>
            <Textarea id="mt-disc" rows={4} value={discussion} onChange={(e) => setDiscussion(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mt-out">Outcome</Label>
            <Textarea id="mt-out" rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
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
