import { CalendarCheck2, CalendarDays, Clock3, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLeaveRequest, useLeaveRequests } from "@/hooks/useLeaveRequests";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { LeaveRequest, LeaveRequestStatus, LeaveRequestType } from "@/types";

const MAX_LEAVE_DAYS = 7;
const STATUS_VARIANT: Record<LeaveRequestStatus, "warning" | "success" | "danger"> = {
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

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayCount(start: string, end: string): number {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}

function readableDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function dateRange(request: LeaveRequest): string {
  if (request.start_date === request.end_date) return readableDate(request.start_date);
  return `${readableDate(request.start_date)} – ${readableDate(request.end_date)}`;
}

export function ProfileVacationPanel() {
  const requests = useLeaveRequests("mine");
  const createRequest = useCreateLeaveRequest();
  const [startDate, setStartDate] = useState(localDate);
  const [endDate, setEndDate] = useState(localDate);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestedDays = dayCount(startDate, endDate);

  const summary = useMemo(() => {
    const approved = (requests.data ?? []).filter((request) => request.status === "approved");
    const fullDays = (type: LeaveRequestType) => approved
      .filter((request) => request.request_type === type && request.duration_unit === "days")
      .reduce((sum, request) => sum + (request.duration_days ?? 0), 0);
    const hourlyLeave = approved
      .filter((request) => request.duration_unit === "hours")
      .reduce((sum, request) => sum + (request.duration_hours ?? 0), 0);
    return {
      vacationDays: fullDays("leave"),
      sickDays: fullDays("sick_leave"),
      absenceDays: fullDays("absent"),
      hourlyLeave,
      pending: (requests.data ?? []).filter((request) => request.status === "pending").length,
    };
  }, [requests.data]);

  const vacationHistory = (requests.data ?? [])
    .filter((request) => request.request_type === "leave" && request.duration_unit === "days")
    .slice(0, 4);

  async function submit() {
    if (requestedDays < 1 || requestedDays > MAX_LEAVE_DAYS) {
      setError(`Vacation can cover at most ${MAX_LEAVE_DAYS} consecutive days.`);
      return;
    }
    if (reason.trim().length < 3) {
      setError("Please add a short reason for the vacation request.");
      return;
    }
    setError(null);
    try {
      await createRequest.mutateAsync({
        request_type: "leave",
        start_date: startDate,
        end_date: endDate,
        duration_unit: "days",
        start_time: null,
        end_time: null,
        reason: reason.trim(),
      });
      setReason("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not submit this vacation request."));
    }
  }

  return (
    <Card className="overflow-hidden border-accent/20">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#073b5c] via-accent to-[#1d729a] px-5 py-5 text-white sm:px-6">
        <div className="absolute -right-8 -top-16 h-40 w-40 rounded-full border-[28px] border-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90"><CalendarCheck2 className="h-4 w-4" /> Vacation &amp; leave record</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Plan time away from your profile</h2>
            <p className="mt-1 text-sm text-white/75">Approved totals and new requests stay synchronized with Attendance &amp; leave.</p>
          </div>
          <Badge className="border border-white/20 bg-white/10 text-white">{summary.pending} pending</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border lg:grid-cols-4 lg:divide-y-0">
        <ProfileLeaveMetric label="Vacation / leave" value={summary.vacationDays} unit="days" />
        <ProfileLeaveMetric label="Sick leave" value={summary.sickDays} unit="days" />
        <ProfileLeaveMetric label="Other absence" value={summary.absenceDays} unit="days" />
        <ProfileLeaveMetric label="Hourly leave" value={summary.hourlyLeave} unit="hours" />
      </div>

      <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-fg">Request vacation</h3>
              <p className="mt-0.5 text-xs text-fg-muted">Choose a start and end date. Your normal approval route will be notified.</p>
            </div>
            <Badge variant="outline">Maximum {MAX_LEAVE_DAYS} days</Badge>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-vacation-start">Start date</Label>
              <Input
                id="profile-vacation-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const next = event.target.value;
                  const maximum = shiftDate(next, MAX_LEAVE_DAYS - 1);
                  setStartDate(next);
                  if (endDate < next || endDate > maximum) setEndDate(next);
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-vacation-end">End date</Label>
              <Input
                id="profile-vacation-end"
                type="date"
                min={startDate}
                max={shiftDate(startDate, MAX_LEAVE_DAYS - 1)}
                value={endDate}
                onChange={(event) => { setEndDate(event.target.value); setError(null); }}
              />
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="profile-vacation-reason">Reason or handover note</Label>
            <Textarea
              id="profile-vacation-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => { setReason(event.target.value); setError(null); }}
              placeholder="Add the information your reviewer needs, including any handover context."
            />
          </div>
          {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-raised/40 p-3">
            <div>
              <p className="text-xs text-fg-muted">Requested duration</p>
              <p className="font-semibold text-fg">{requestedDays} day{requestedDays === 1 ? "" : "s"} · {readableDate(startDate)}{startDate === endDate ? "" : ` to ${readableDate(endDate)}`}</p>
            </div>
            <Button onClick={submit} disabled={createRequest.isPending || requestedDays < 1 || requestedDays > MAX_LEAVE_DAYS}>
              {createRequest.isPending ? <Spinner /> : <Send className="h-4 w-4" />} Submit vacation
            </Button>
          </div>
          <p className="mt-3 text-xs text-fg-muted">Need hourly leave, sick leave, or an absence reason? <Link to="/attendance?section=leave" className="font-semibold text-accent hover:underline">Open the full Leave center</Link>.</p>
        </div>

        <div className="rounded-xl border border-border bg-raised/25 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-fg">Recent vacation details</h3>
            <CalendarDays className="h-4 w-4 text-accent" />
          </div>
          {requests.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : vacationHistory.length ? (
            <div className="mt-3 space-y-2">
              {vacationHistory.map((request) => (
                <div key={request.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">{dateRange(request)}</p>
                    <Badge variant={STATUS_VARIANT[request.status]} className="capitalize">{request.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{request.duration_days ?? 1} day{request.duration_days === 1 ? "" : "s"} · {request.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-surface px-4 py-7 text-center">
              <Clock3 className="mx-auto h-5 w-5 text-fg-subtle" />
              <p className="mt-2 text-sm font-medium text-fg">No vacation requests yet</p>
              <p className="mt-1 text-xs text-fg-muted">Your submitted dates will appear here.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileLeaveMetric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-accent">
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-medium text-fg-muted">{unit}</span>
      </p>
    </div>
  );
}
