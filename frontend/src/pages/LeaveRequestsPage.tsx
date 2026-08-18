import {
  CalendarClock,
  CheckCircle2,
  Send,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  useCreateLeaveRequest,
  useLeaveRequests,
  useReviewLeaveRequest,
} from "@/hooks/useLeaveRequests";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { LeaveRequest, LeaveRequestStatus, LeaveRequestType } from "@/types";

const TYPE_LABELS: Record<LeaveRequestType, string> = {
  leave: "Leave",
  sick_leave: "Sick leave",
  absent: "Absence",
};

const STATUS_VARIANTS: Record<
  LeaveRequestStatus,
  "warning" | "success" | "danger"
> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function readableDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function LeaveRequestsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { isAdmin } = useAuth();
  const requests = useLeaveRequests(isAdmin ? "all" : "mine");
  const createRequest = useCreateLeaveRequest();
  const reviewRequest = useReviewLeaveRequest();

  const [requestType, setRequestType] = useState<LeaveRequestType>("leave");
  const [startDate, setStartDate] = useState(localDate);
  const [endDate, setEndDate] = useState(localDate);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{
    request: LeaveRequest;
    status: "approved" | "rejected";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [autofill, setAutofill] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => (requests.data ?? []).filter((request) => request.status === "pending").length,
    [requests.data],
  );

  async function submitRequest() {
    if (reason.trim().length < 3) {
      setFormError("Please add a short reason for the request.");
      return;
    }
    setFormError(null);
    try {
      await createRequest.mutateAsync({
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });
      setReason("");
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not submit this request."));
    }
  }

  function openReview(request: LeaveRequest, status: "approved" | "rejected") {
    setReviewing({ request, status });
    setReviewNote("");
    setAutofill(status === "approved");
    setReviewError(null);
  }

  async function submitReview() {
    if (!reviewing) return;
    setReviewError(null);
    try {
      await reviewRequest.mutateAsync({
        requestId: reviewing.request.id,
        payload: {
          status: reviewing.status,
          review_note: reviewNote.trim() || null,
          autofill_attendance: reviewing.status === "approved" && autofill,
        },
      });
      setReviewing(null);
    } catch (error) {
      setReviewError(getApiErrorMessage(error, "Could not review this request."));
    }
  }

  if (requests.isLoading) return <Spinner />;
  if (requests.isError) {
    return (
      <ErrorState
        message="Could not load leave requests."
        onRetry={() => requests.refetch()}
      />
    );
  }

  const requestForm = (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-fg">Submit a leave or absence reason</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Your administrator will receive this note and decide whether to add it to attendance.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-type">Request type</Label>
          <Select
            id="leave-type"
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as LeaveRequestType)}
          >
            <option value="leave">Leave</option>
            <option value="sick_leave">Sick leave</option>
            <option value="absent">Absence reason</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-start">From</Label>
          <Input id="leave-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-end">To</Label>
          <Input id="leave-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="leave-reason">Reason or note</Label>
        <Textarea
          id="leave-reason"
          rows={4}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain the leave or absence so the admin has enough information to review it."
        />
      </div>
      {formError && <p className="mt-3 text-sm text-danger">{formError}</p>}
      <div className="mt-4 flex justify-end">
        <Button onClick={submitRequest} disabled={createRequest.isPending}>
          {createRequest.isPending ? <Spinner /> : <Send className="h-4 w-4" />}
          Submit request
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-accent" />
              <h1 className="font-display text-2xl font-bold text-fg">Leave &amp; absence</h1>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              Submit reasons, review requests, and keep attendance linked to the approval record.
            </p>
          </div>
          {isAdmin && <Badge variant={pendingCount ? "warning" : "success"}>{pendingCount} pending</Badge>}
        </div>
      )}

      {isAdmin ? (
        <RequestList requests={requests.data ?? []} canReview onReview={openReview} />
      ) : (
        <div className="space-y-5">
          {requestForm}
          <RequestList requests={requests.data ?? []} />
        </div>
      )}

      {reviewing && (
        <Dialog open onOpenChange={() => setReviewing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewing.status === "approved" ? "Approve" : "Reject"} request #{reviewing.request.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-raised/50 p-3 text-sm">
                <p className="font-medium text-fg">{reviewing.request.employee_name}</p>
                <p className="text-fg-muted">{TYPE_LABELS[reviewing.request.request_type]} · {readableDate(reviewing.request.start_date)} to {readableDate(reviewing.request.end_date)}</p>
                <p className="mt-2 text-fg">{reviewing.request.reason}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-note">Admin note (optional)</Label>
                <Textarea id="review-note" rows={3} maxLength={1000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
              </div>
              {reviewing.status === "approved" && (
                <label className="flex gap-3 rounded-lg border border-border p-3 text-sm text-fg">
                  <input type="checkbox" checked={autofill} onChange={(event) => setAutofill(event.target.checked)} />
                  <span>
                    <span className="flex items-center gap-1 font-medium"><WandSparkles className="h-4 w-4 text-accent" />Autofill attendance</span>
                    <span className="mt-1 block text-xs text-fg-muted">Fill every date in this request and tag each row with request #{reviewing.request.id}.</span>
                  </span>
                </label>
              )}
              {reviewError && <p className="text-sm text-danger">{reviewError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button
                variant={reviewing.status === "rejected" ? "danger" : "default"}
                onClick={submitReview}
                disabled={reviewRequest.isPending}
              >
                {reviewRequest.isPending ? <Spinner /> : reviewing.status === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                Confirm {reviewing.status === "approved" ? "approval" : "rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RequestList({
  requests,
  canReview = false,
  onReview,
}: {
  requests: LeaveRequest[];
  canReview?: boolean;
  onReview?: (request: LeaveRequest, status: "approved" | "rejected") => void;
}) {
  if (requests.length === 0) {
    return <EmptyState title="No requests yet" description="New leave and absence notes will appear here." />;
  }
  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-fg">{request.employee_name}</p>
                <Badge variant="outline">{TYPE_LABELS[request.request_type]}</Badge>
                <Badge variant={STATUS_VARIANTS[request.status]} className="capitalize">{request.status}</Badge>
                {request.attendance_autofilled && <Badge variant="default"><WandSparkles className="h-3 w-3" />Attendance tagged</Badge>}
              </div>
              <p className="mt-1 text-sm font-medium text-fg-muted">
                {readableDate(request.start_date)} – {readableDate(request.end_date)}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-fg">{request.reason}</p>
              {request.review_note && (
                <p className="mt-3 rounded-md bg-raised/60 px-3 py-2 text-sm text-fg-muted">
                  <span className="font-medium text-fg">Admin note:</span> {request.review_note}
                </p>
              )}
              {request.reviewed_by_name && <p className="mt-2 text-xs text-fg-subtle">Reviewed by {request.reviewed_by_name}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {request.attendance_autofilled && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/attendance?date=${request.start_date}`}>Open attendance</Link>
                </Button>
              )}
              {canReview && request.status === "pending" && onReview && (
                <>
                  <Button variant="outline" size="sm" onClick={() => onReview(request, "rejected")}><XCircle className="h-4 w-4" />Reject</Button>
                  <Button size="sm" onClick={() => onReview(request, "approved")}><CheckCircle2 className="h-4 w-4" />Approve</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
