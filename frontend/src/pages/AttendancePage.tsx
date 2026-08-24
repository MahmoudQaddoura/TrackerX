import {
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
  Search,
  Undo2,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { AttendanceInput } from "@/api/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useAttendance, useSaveAttendance } from "@/hooks/useAttendance";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import type { AttendanceRecord, AttendanceStatus } from "@/types";

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "not_recorded", label: "Not recorded" },
  { value: "present", label: "Present" },
  { value: "remote", label: "Remote" },
  { value: "leave", label: "Leave" },
  { value: "sick_leave", label: "Sick leave" },
  { value: "absent", label: "Absent" },
];

const STATUS_BADGE: Record<
  AttendanceStatus,
  "neutral" | "success" | "default" | "warning" | "danger" | "outline"
> = {
  not_recorded: "outline",
  present: "success",
  remote: "default",
  leave: "warning",
  sick_leave: "warning",
  absent: "danger",
};

const STATUS_SELECT_STYLE: Record<AttendanceStatus, string> = {
  not_recorded: "border-border bg-input text-fg-muted",
  present: "border-success/25 bg-success/10 text-success",
  remote: "border-accent/25 bg-accent-soft text-accent",
  leave: "border-warning/25 bg-warning/10 text-warning",
  sick_leave: "border-warning/25 bg-warning/10 text-warning",
  absent: "border-danger/25 bg-danger/10 text-danger",
};

type AttendanceFilter = "all" | "unrecorded" | "on_duty" | "away";

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function labelFor(status: AttendanceStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function isOnDuty(status: AttendanceStatus): boolean {
  return status === "present" || status === "remote";
}

function isAway(status: AttendanceStatus): boolean {
  return status === "leave" || status === "sick_leave" || status === "absent";
}

export function AttendancePage({ embedded = false }: { embedded?: boolean } = {}) {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get("date") ?? localDate());
  const attendance = useAttendance(date);
  const save = useSaveAttendance(date);
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [officeStart, setOfficeStart] = useState(DEFAULT_START);
  const [officeEnd, setOfficeEnd] = useState(DEFAULT_END);
  const [autoFillHours, setAutoFillHours] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");

  useEffect(() => {
    setRows(attendance.data ?? []);
    setDirty(false);
    setSaveError(null);
  }, [attendance.data, date]);

  useEffect(() => {
    setSavedAt(null);
  }, [date]);

  const counts = useMemo(() => {
    const recorded = rows.filter((row) => row.status !== "not_recorded").length;
    const attending = rows.filter((row) => isOnDuty(row.status)).length;
    const away = rows.filter((row) => isAway(row.status)).length;
    return {
      total: rows.length,
      recorded,
      attending,
      away,
      unrecorded: rows.length - recorded,
      fillable: rows.filter(
        (row) => row.status === "not_recorded" && !row.leave_request_id,
      ).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.employee_name.toLowerCase().includes(query) ||
        Boolean(row.employee_role?.toLowerCase().includes(query));
      const matchesFilter =
        filter === "all" ||
        (filter === "unrecorded" && row.status === "not_recorded") ||
        (filter === "on_duty" && isOnDuty(row.status)) ||
        (filter === "away" && isAway(row.status));
      return matchesSearch && matchesFilter;
    });
  }, [filter, rows, search]);

  function updateRow(memberId: number, patch: Partial<AttendanceRecord>) {
    setRows((current) =>
      current.map((row) =>
        row.team_member_id === memberId ? { ...row, ...patch } : row,
      ),
    );
    setDirty(true);
    setSavedAt(null);
    setSaveError(null);
  }

  function updateStatus(memberId: number, status: AttendanceStatus) {
    const row = rows.find((item) => item.team_member_id === memberId);
    if (!row) return;
    const patch: Partial<AttendanceRecord> = { status };
    if (isOnDuty(status)) {
      patch.check_in = row.check_in ?? (autoFillHours ? officeStart : null);
      patch.check_out = row.check_out ?? (autoFillHours ? officeEnd : null);
    } else {
      patch.check_in = null;
      patch.check_out = null;
    }
    updateRow(memberId, patch);
  }

  function markAllPresent() {
    let changed = false;
    const next = rows.map((row) => {
      if (row.status !== "not_recorded" || row.leave_request_id) return row;
      changed = true;
      return {
        ...row,
        status: "present" as const,
        check_in: autoFillHours ? officeStart : null,
        check_out: autoFillHours ? officeEnd : null,
      };
    });
    if (!changed) return;
    setRows(next);
    setDirty(true);
    setSavedAt(null);
    setSaveError(null);
  }

  function applyOfficeHours() {
    let changed = false;
    const next = rows.map((row) => {
      if (!isOnDuty(row.status)) return row;
      if (row.check_in === officeStart && row.check_out === officeEnd) return row;
      changed = true;
      return { ...row, check_in: officeStart, check_out: officeEnd };
    });
    if (!changed) return;
    setRows(next);
    setDirty(true);
    setSavedAt(null);
    setSaveError(null);
  }

  function discardChanges() {
    setRows(attendance.data ?? []);
    setDirty(false);
    setSaveError(null);
  }

  async function handleSave() {
    const payload: AttendanceInput[] = rows.map((row) => ({
      team_member_id: row.team_member_id,
      attendance_date: date,
      status: row.status,
      check_in: row.check_in || null,
      check_out: row.check_out || null,
      notes: row.notes?.trim() || null,
    }));
    setSaveError(null);
    try {
      await save.mutateAsync(payload);
      setDirty(false);
      setSavedAt(new Date());
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "Could not save the attendance sheet."));
    }
  }

  if (attendance.isLoading) return <Spinner />;
  if (attendance.isError) {
    return (
      <ErrorState
        message="Could not load attendance."
        onRetry={() => attendance.refetch()}
      />
    );
  }

  const isToday = date === localDate();
  const completion = counts.total ? Math.round((counts.recorded / counts.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {!embedded && (
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-6 w-6 text-accent" />
            <h1 className="font-display text-2xl font-bold text-fg">Attendance</h1>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {isAdmin ? "Record attendance quickly and accurately." : "View your daily attendance record."}
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-accent-soft/70 to-surface p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-semibold text-fg">{formatDate(date)}</h2>
              {isToday && <Badge variant="default">Today</Badge>}
              {dirty && <Badge variant="warning">Unsaved</Badge>}
              {!dirty && savedAt && (
                <Badge variant="success">
                  Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border sm:w-56">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-xs font-medium text-fg-muted">{completion}% recorded</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              title={dirty ? "Save or discard changes before changing the date" : "Previous day"}
              disabled={dirty}
              onClick={() => setDate(shiftDate(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              aria-label="Attendance date"
              className="w-[150px] bg-surface"
              type="date"
              value={date}
              disabled={dirty}
              onChange={(event) => event.target.value && setDate(event.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              title={dirty ? "Save or discard changes before changing the date" : "Next day"}
              disabled={dirty}
              onClick={() => setDate(shiftDate(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button variant="outline" size="sm" disabled={dirty} onClick={() => setDate(localDate())}>
                Today
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-y-0">
          <SummaryMetric icon={Users} label="Employees" value={counts.total} />
          <SummaryMetric icon={CheckCircle2} label="Recorded" value={`${counts.recorded}/${counts.total}`} tone="accent" />
          <SummaryMetric icon={UserCheck} label="On duty" value={counts.attending} tone="success" />
          <SummaryMetric icon={CalendarCheck2} label="Away" value={counts.away} tone="warning" />
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No attendance rows"
          description="This account is not linked to an active employee profile yet."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-fg">Daily attendance</h2>
                <p className="mt-0.5 text-xs text-fg-muted">
                  Office-local time · leave-linked rows are protected from bulk attendance.
                </p>
              </div>

              {isAdmin && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Start</span>
                    <Input
                      aria-label="Default office start"
                      className="w-[112px]"
                      type="time"
                      value={officeStart}
                      onChange={(event) => setOfficeStart(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">End</span>
                    <Input
                      aria-label="Default office end"
                      className="w-[112px]"
                      type="time"
                      value={officeEnd}
                      onChange={(event) => setOfficeEnd(event.target.value)}
                    />
                  </label>
                  <Button variant="outline" size="sm" onClick={applyOfficeHours} disabled={!counts.attending}>
                    <Clock3 className="h-4 w-4" />
                    Apply hours
                  </Button>
                  <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg">
                    <input
                      type="checkbox"
                      checked={autoFillHours}
                      onChange={(event) => setAutoFillHours(event.target.checked)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    Auto-fill hours
                  </label>
                  <Button size="sm" onClick={markAllPresent} disabled={!counts.fillable}>
                    <UserCheck className="h-4 w-4" />
                    Mark all present
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employee or role"
                    aria-label="Search attendance"
                  />
                </div>
                <Select
                  className="w-full sm:w-[175px]"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as AttendanceFilter)}
                  aria-label="Filter attendance status"
                >
                  <option value="all">All employees</option>
                  <option value="unrecorded">Unrecorded ({counts.unrecorded})</option>
                  <option value="on_duty">On duty ({counts.attending})</option>
                  <option value="away">Away ({counts.away})</option>
                </Select>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-end gap-2">
                  {dirty && (
                    <Button variant="ghost" size="sm" onClick={discardChanges}>
                      <Undo2 className="h-4 w-4" />
                      Discard
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
                    {save.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
                    Save attendance
                  </Button>
                </div>
              )}
            </div>
          </div>

          {saveError && (
            <div className="border-b border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {saveError}
            </div>
          )}

          {visibleRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-fg">No employees match this view</p>
              <button
                type="button"
                className="mt-1 text-sm font-medium text-accent hover:underline"
                onClick={() => { setSearch(""); setFilter("all"); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[830px] table-fixed text-left text-sm">
                  <thead className="bg-raised/60 text-[11px] uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th className="w-[25%] px-4 py-3 font-semibold">Employee</th>
                      <th className="w-[11%] px-3 py-3 text-center font-semibold">Attended</th>
                      <th className="w-[15%] px-3 py-3 font-semibold">Status</th>
                      <th className="w-[14%] px-3 py-3 font-semibold">Check-in</th>
                      <th className="w-[14%] px-3 py-3 font-semibold">Check-out</th>
                      <th className="px-3 py-3 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleRows.map((row) => (
                      <AttendanceTableRow
                        key={row.team_member_id}
                        row={row}
                        isAdmin={isAdmin}
                        onStatusChange={updateStatus}
                        onUpdate={updateRow}
                      />
                    ))}
                  </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border bg-raised/30 px-4 py-2.5 text-xs text-fg-muted">
            <span>Showing {visibleRows.length} of {rows.length} employees</span>
            {dirty ? <span className="font-medium text-warning">Changes not saved</span> : <span>Sheet up to date</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone?: "neutral" | "accent" | "success" | "warning";
}) {
  const tones = {
    neutral: "bg-raised text-fg-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className="text-lg font-bold leading-tight text-fg">{value}</p>
      </div>
    </div>
  );
}

type RowEditorProps = {
  row: AttendanceRecord;
  isAdmin: boolean;
  onStatusChange: (memberId: number, status: AttendanceStatus) => void;
  onUpdate: (memberId: number, patch: Partial<AttendanceRecord>) => void;
};

function AttendanceTableRow(props: RowEditorProps) {
  const { row, isAdmin } = props;
  return (
    <tr className="bg-surface align-middle transition-colors hover:bg-raised/30">
      <td className="px-4 py-3">
        <EmployeeIdentity row={row} />
      </td>
      <td className="px-3 py-3">
        <label className="flex cursor-pointer items-center justify-center gap-2">
          <input
            type="checkbox"
            checked={isOnDuty(row.status)}
            disabled={!isAdmin}
            onChange={(event) =>
              props.onStatusChange(
                row.team_member_id,
                event.target.checked ? "present" : "absent",
              )
            }
            aria-label={`Mark ${row.employee_name} attended`}
            className="h-5 w-5 rounded border-border accent-accent disabled:cursor-not-allowed"
          />
          <span className={cn("text-xs font-medium", isOnDuty(row.status) ? "text-success" : "text-fg-subtle")}>
            {isOnDuty(row.status) ? "Yes" : "No"}
          </span>
        </label>
      </td>
      <td className="px-3 py-3">
        <StatusControl {...props} />
      </td>
      <td className="px-3 py-3">
        <TimeControl {...props} field="check_in" label="Check-in" />
      </td>
      <td className="px-3 py-3">
        <TimeControl {...props} field="check_out" label="Check-out" />
      </td>
      <td className="px-3 py-3">
        {isAdmin ? (
          <Input
            className="w-full min-w-0"
            value={row.notes ?? ""}
            placeholder="Add a note"
            onChange={(event) => props.onUpdate(row.team_member_id, { notes: event.target.value })}
          />
        ) : (
          <span className="text-fg-muted">{row.notes ?? "—"}</span>
        )}
      </td>
    </tr>
  );
}

function EmployeeIdentity({ row }: { row: AttendanceRecord }) {
  const initials = row.employee_name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-fg">{row.employee_name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-fg-subtle">{row.employee_role ?? "No role"}</span>
          {row.leave_request_id && (
            <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
              Leave #{row.leave_request_id}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusControl({ row, isAdmin, onStatusChange }: RowEditorProps) {
  if (!isAdmin) return <Badge variant={STATUS_BADGE[row.status]}>{labelFor(row.status)}</Badge>;
  return (
    <Select
      aria-label={`${row.employee_name} status`}
      className={cn("w-full min-w-0 font-medium", STATUS_SELECT_STYLE[row.status])}
      value={row.status}
      onChange={(event) => onStatusChange(row.team_member_id, event.target.value as AttendanceStatus)}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </Select>
  );
}

function TimeControl({
  row,
  isAdmin,
  onUpdate,
  field,
  label,
}: RowEditorProps & {
  field: "check_in" | "check_out";
  label: string;
}) {
  const enabled = isOnDuty(row.status);
  if (!isAdmin) {
    return (
      <span className="text-fg-muted">{row[field] ?? "—"}</span>
    );
  }
  return (
    <label className="block">
      <Input
        aria-label={`${row.employee_name} ${label.toLowerCase()}`}
        className="w-full min-w-0"
        type="time"
        disabled={!enabled}
        value={row[field] ?? ""}
        onChange={(event) => onUpdate(row.team_member_id, { [field]: event.target.value || null })}
      />
    </label>
  );
}
