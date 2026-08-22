import {
  CalendarDays,
  CalendarClock,
  Clock3,
  Send,
  UserRoundCheck,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoveragePlanningDialog } from "@/components/attendance/CoveragePlanningDialog";
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
import type {
  LeaveDurationUnit,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveRequestType,
} from "@/types";

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

function calculateHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(0, ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60);
}

function durationLabel(request: LeaveRequest): string {
  if (request.duration_unit === "hours") {
    const hours = request.duration_hours ?? 0;
    return `${hours.toLocaleString(undefined, { maximumFractionDigits: 2 })} hour${hours === 1 ? "" : "s"}`;
  }
  const days = request.duration_days ?? 1;
  return `${days} day${days === 1 ? "" : "s"}`;
}

function scheduleLabel(request: LeaveRequest): string {
  if (request.duration_unit === "hours") {
    return `${readableDate(request.start_date)} · ${request.start_time}–${request.end_time}`;
  }
  if (request.start_date === request.end_date) return readableDate(request.start_date);
  return `${readableDate(request.start_date)} – ${readableDate(request.end_date)}`;
}

export function LeaveRequestsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { isAdmin } = useAuth();
  const requests = useLeaveRequests(isAdmin ? "all" : "mine");
  const createRequest = useCreateLeaveRequest();
  const reviewRequest = useReviewLeaveRequest();

  const [requestType, setRequestType] = useState<LeaveRequestType>("leave");
  const [durationUnit, setDurationUnit] = useState<LeaveDurationUnit>("days");
  const [startDate, setStartDate] = useState(localDate);
  const [endDate, setEndDate] = useState(localDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [coverageRequest, setCoverageRequest] = useState<LeaveRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => (requests.data ?? []).filter((request) => request.status === "pending").length,
    [requests.data],
  );

  async function submitRequest() {
    if (reason.trim().length < 3) {
      setFormError("Please add a short reason for the request.");
      return;
    }
    if (durationUnit === "hours" && calculateHours(startTime, endTime) <= 0) {
      setFormError("End time must be after start time.");
      return;
    }
    setFormError(null);
    try {
      await createRequest.mutateAsync({
        request_type: requestType,
        start_date: startDate,
        end_date: durationUnit === "hours" ? startDate : endDate,
        duration_unit: durationUnit,
        start_time: durationUnit === "hours" ? startTime : null,
        end_time: durationUnit === "hours" ? endTime : null,
        reason: reason.trim(),
      });
      setReason("");
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not submit this request."));
    }
  }

  function openRejection(request: LeaveRequest) {
    setRejectingRequest(request);
    setRejectionNote("");
    setRejectionError(null);
  }

  async function submitRejection() {
    if (!rejectingRequest) return;
    setRejectionError(null);
    try {
      await reviewRequest.mutateAsync({
        requestId: rejectingRequest.id,
        payload: {
          status: "rejected",
          review_note: rejectionNote.trim() || null,
          autofill_attendance: false,
        },
      });
      setRejectingRequest(null);
    } catch (error) {
      setRejectionError(getApiErrorMessage(error, "Could not reject this request."));
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
      <div className="grid gap-4 md:grid-cols-2">
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
          <Label>Duration</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDurationUnit("days")}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                durationUnit === "days"
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:bg-raised"
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Full day(s)
            </button>
            <button
              type="button"
              onClick={() => setDurationUnit("hours")}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                durationUnit === "hours"
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:bg-raised"
              }`}
            >
              <Clock3 className="h-4 w-4" /> Hours
            </button>
          </div>
        </div>
      </div>
      {durationUnit === "days" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-start">First day</Label>
            <Input id="leave-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-end">Last day</Label>
            <Input id="leave-end" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-hour-date">Date</Label>
            <Input id="leave-hour-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-start-time">Start time</Label>
            <Input id="leave-start-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-end-time">End time</Label>
            <Input id="leave-end-time" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </div>
          <div className="sm:col-span-3 flex items-center justify-between rounded-lg bg-raised/60 px-3 py-2 text-sm">
            <span className="text-fg-muted">Requested time</span>
            <span className="font-semibold text-fg">
              {calculateHours(startTime, endTime).toLocaleString(undefined, { maximumFractionDigits: 2 })} hours
            </span>
          </div>
        </div>
      )}
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
        <RequestList
          requests={requests.data ?? []}
          canReview
          onManageCoverage={setCoverageRequest}
          onReject={openRejection}
        />
      ) : (
        <div className="space-y-5">
          {requestForm}
          <RequestList requests={requests.data ?? []} />
        </div>
      )}

      <CoveragePlanningDialog request={coverageRequest} onClose={() => setCoverageRequest(null)} />

      <Dialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
          </DialogHeader>
          {rejectingRequest && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-raised/50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-fg">{rejectingRequest.employee_name}</p>
                  <Badge variant="default">
                    {rejectingRequest.duration_unit === "hours" ? <Clock3 className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
                    {durationLabel(rejectingRequest)}
                  </Badge>
                </div>
                <p className="mt-1 text-fg-muted">{TYPE_LABELS[rejectingRequest.request_type]} · {scheduleLabel(rejectingRequest)}</p>
                <p className="mt-2 text-fg">{rejectingRequest.reason}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rejection-note">Admin note</Label>
                <Textarea
                  id="rejection-note"
                  rows={3}
                  maxLength={1000}
                  value={rejectionNote}
                  onChange={(event) => setRejectionNote(event.target.value)}
                  placeholder="Optional reason or next step for the employee."
                />
              </div>
              <p className="text-xs text-fg-muted">Rejecting this request will not change attendance or task assignments.</p>
              {rejectionError && <p className="text-sm text-danger">{rejectionError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingRequest(null)}>Cancel</Button>
            <Button variant="danger" onClick={submitRejection} disabled={reviewRequest.isPending}>
              {reviewRequest.isPending ? <Spinner /> : <XCircle className="h-4 w-4" />}
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestList({
  requests,
  canReview = false,
  onManageCoverage,
  onReject,
}: {
  requests: LeaveRequest[];
  canReview?: boolean;
  onManageCoverage?: (request: LeaveRequest) => void;
  onReject?: (request: LeaveRequest) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "all">("all");
  if (requests.length === 0) {
    return <EmptyState title="No requests yet" description="New leave and absence notes will appear here." />;
  }
  const filteredRequests = statusFilter === "all"
    ? requests
    : requests.filter((request) => request.status === statusFilter);
  const filterOptions: { value: LeaveRequestStatus | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];
  return (
    <div className="space-y-4">
      {canReview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
          <div>
            <p className="text-sm font-semibold text-fg">Request inbox</p>
            <p className="text-xs text-fg-muted">Review full-day and hourly requests from the team.</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-raised/60 p-1">
            {filterOptions.map((option) => {
              const count = option.value === "all"
                ? requests.length
                : requests.filter((request) => request.status === option.value).length;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === option.value
                      ? "bg-surface text-fg shadow-sm"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {option.label} {count}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {filteredRequests.length === 0 && (
        <EmptyState title={`No ${statusFilter} requests`} description="Choose another filter to view request history." />
      )}
      {filteredRequests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-fg">{request.employee_name}</p>
                <Badge variant="outline">{TYPE_LABELS[request.request_type]}</Badge>
                <Badge variant="default">
                  {request.duration_unit === "hours" ? <Clock3 className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
                  {durationLabel(request)}
                </Badge>
                <Badge variant={STATUS_VARIANTS[request.status]} className="capitalize">{request.status}</Badge>
                {request.attendance_autofilled && <Badge variant="default"><WandSparkles className="h-3 w-3" />Attendance tagged</Badge>}
                {request.coverage_pending > 0 && <Badge variant="warning">{request.coverage_pending} coverage pending</Badge>}
                {request.coverage_accepted > 0 && <Badge variant="success">{request.coverage_accepted} accepted</Badge>}
                {request.coverage_declined > 0 && <Badge variant="danger">{request.coverage_declined} declined</Badge>}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-fg-muted">
                {request.duration_unit === "hours" ? <Clock3 className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                {scheduleLabel(request)}
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
              {canReview && onManageCoverage && request.status === "pending" && (
                <>
                  {onReject && <Button variant="outline" size="sm" onClick={() => onReject(request)}><XCircle className="h-4 w-4" />Reject</Button>}
                  <Button size="sm" onClick={() => onManageCoverage(request)}><UserRoundCheck className="h-4 w-4" />Assign &amp; approve</Button>
                </>
              )}
              {canReview && onManageCoverage && request.status === "approved" && request.coverage_declined > 0 && (
                <Button variant="outline" size="sm" onClick={() => onManageCoverage(request)}><UserRoundCheck className="h-4 w-4" />Manage coverage</Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
