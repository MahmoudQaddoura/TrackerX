import {
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
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
import type { AttendanceRecord, AttendanceStatus } from "@/types";

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

function labelFor(status: AttendanceStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function AttendancePage() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get("date") ?? localDate());
  const attendance = useAttendance(date);
  const save = useSaveAttendance(date);
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setRows(attendance.data ?? []);
    setDirty(false);
    setSaveError(null);
  }, [attendance.data, date]);

  const counts = useMemo(() => {
    const recorded = rows.filter((row) => row.status !== "not_recorded").length;
    const attending = rows.filter(
      (row) => row.status === "present" || row.status === "remote",
    ).length;
    const away = rows.filter((row) =>
      ["leave", "sick_leave", "absent"].includes(row.status),
    ).length;
    return { total: rows.length, recorded, attending, away };
  }, [rows]);

  function updateRow(memberId: number, patch: Partial<AttendanceRecord>) {
    setRows((current) =>
      current.map((row) =>
        row.team_member_id === memberId ? { ...row, ...patch } : row,
      ),
    );
    setDirty(true);
    setSaveError(null);
  }

  function markAllPresent() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        status: "present",
        check_in: row.check_in ?? "09:00",
        check_out: row.check_out ?? "17:00",
      })),
    );
    setDirty(true);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-6 w-6 text-accent" />
            <h1 className="font-display text-2xl font-bold text-fg">Attendance</h1>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {isAdmin
              ? "Record the daily attendance sheet for every active employee."
              : "View your daily attendance record."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => setDate(shiftDate(date, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            className="w-[155px]"
            type="date"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => setDate(shiftDate(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(localDate())}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Employees", value: counts.total, icon: Users },
          { label: "Recorded", value: `${counts.recorded}/${counts.total}`, icon: CheckCircle2 },
          { label: "On duty", value: counts.attending, icon: Clock3 },
          { label: "Away", value: counts.away, icon: CalendarCheck2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
              <p className="text-xl font-bold text-fg">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No attendance rows"
          description="This account is not linked to an active employee profile yet."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-semibold text-fg">Daily sheet</h2>
              <p className="text-xs text-fg-muted">Times use the local office time. Notes are optional.</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                {dirty && <Badge variant="warning">Unsaved changes</Badge>}
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  Mark all present
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
                  {save.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
                  Save sheet
                </Button>
              </div>
            )}
          </div>
          {saveError && (
            <div className="border-b border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {saveError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-raised/60 text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Check-in</th>
                  <th className="px-3 py-3 font-semibold">Check-out</th>
                  <th className="px-3 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.team_member_id}
                    className="bg-surface align-middle hover:bg-raised/25"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{row.employee_name}</p>
                      <p className="text-xs text-fg-subtle">{row.employee_role ?? "No role"}</p>
                    </td>
                    <td className="px-3 py-3">
                      {row.leave_request_id && (
                        <Badge variant="default" className="mb-1.5 text-[10px]">
                          Leave request #{row.leave_request_id}
                        </Badge>
                      )}
                      {isAdmin ? (
                        <Select
                          className="min-w-[140px]"
                          value={row.status}
                          onChange={(event) =>
                            updateRow(row.team_member_id, {
                              status: event.target.value as AttendanceStatus,
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge variant={STATUS_BADGE[row.status]}>{labelFor(row.status)}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <Input
                          className="w-[125px]"
                          type="time"
                          value={row.check_in ?? ""}
                          onChange={(event) =>
                            updateRow(row.team_member_id, { check_in: event.target.value || null })
                          }
                        />
                      ) : <span className="text-fg-muted">{row.check_in ?? "—"}</span>}
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <Input
                          className="w-[125px]"
                          type="time"
                          value={row.check_out ?? ""}
                          onChange={(event) =>
                            updateRow(row.team_member_id, { check_out: event.target.value || null })
                          }
                        />
                      ) : <span className="text-fg-muted">{row.check_out ?? "—"}</span>}
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <Input
                          className="min-w-[220px]"
                          value={row.notes ?? ""}
                          placeholder="Optional note"
                          onChange={(event) =>
                            updateRow(row.team_member_id, { notes: event.target.value })
                          }
                        />
                      ) : <span className="text-fg-muted">{row.notes ?? "—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
