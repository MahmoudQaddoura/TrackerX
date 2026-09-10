import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  MonitorUp,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmAttendance, useMyAttendance } from "@/hooks/useAttendance";
import { getApiErrorMessage } from "@/lib/apiClient";

type WorkMode = "present" | "remote";

export function AttendanceConfirmation() {
  const attendance = useMyAttendance();
  const confirm = useConfirmAttendance();
  const [workMode, setWorkMode] = useState<WorkMode>("present");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "check_in" | "check_out") {
    setError(null);
    try {
      await confirm.mutateAsync({ action, work_mode: workMode, notes: notes.trim() || null });
      setNotes("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not confirm attendance."));
    }
  }

  if (attendance.isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (attendance.isError || !attendance.data) {
    return <ErrorState message="Could not load your attendance confirmation." onRetry={() => attendance.refetch()} />;
  }

  const record = attendance.data;
  const isAway = ["leave", "sick_leave", "absent"].includes(record.status);
  const checkedIn = Boolean(record.check_in && record.confirmed_by_employee);
  const checkedOut = Boolean(record.check_out && record.confirmed_by_employee);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="overflow-hidden border-accent/20">
        <div className="bg-gradient-to-br from-[#073b5c] via-accent to-[#1d729a] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold"><BadgeCheck className="h-3.5 w-3.5" /> Personal attendance</span>
              <h2 className="mt-3 font-display text-2xl font-bold">Confirm today’s attendance</h2>
              <p className="mt-1 text-sm text-white/75">TrackerX records the official Amman office time. Confirmations cannot replace approved leave.</p>
            </div>
            <Badge className="border-white/20 bg-white/10 text-white">ID {record.employee_number}</Badge>
          </div>
        </div>

        <div className="p-5">
          {isAway ? (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-4">
              <p className="font-semibold text-fg">Attendance is linked to leave</p>
              <p className="mt-1 text-sm text-fg-muted">Today is recorded as {record.status.replace("_", " ")}. Check-in is disabled while this approved absence is active.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWorkMode("present")} disabled={checkedIn} className={`rounded-xl border p-4 text-left transition ${workMode === "present" ? "border-accent bg-accent-soft" : "border-border hover:bg-raised"} disabled:cursor-not-allowed disabled:opacity-70`}>
                  <Building2 className="h-5 w-5 text-accent" />
                  <span className="mt-2 block font-semibold text-fg">Office</span>
                  <span className="text-xs text-fg-muted">Working on site</span>
                </button>
                <button type="button" onClick={() => setWorkMode("remote")} disabled={checkedIn} className={`rounded-xl border p-4 text-left transition ${workMode === "remote" ? "border-accent bg-accent-soft" : "border-border hover:bg-raised"} disabled:cursor-not-allowed disabled:opacity-70`}>
                  <MonitorUp className="h-5 w-5 text-accent" />
                  <span className="mt-2 block font-semibold text-fg">Remote</span>
                  <span className="text-xs text-fg-muted">Working off site</span>
                </button>
              </div>
              <Textarea className="mt-4" rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional work-location or attendance note" />
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => submit("check_in")} disabled={checkedIn || confirm.isPending}>{confirm.isPending ? <Spinner /> : <LogIn className="h-4 w-4" />} {checkedIn ? "Checked in" : "Confirm check-in"}</Button>
                <Button variant="outline" onClick={() => submit("check_out")} disabled={!checkedIn || checkedOut || confirm.isPending}>{confirm.isPending ? <Spinner /> : <LogOut className="h-4 w-4" />} {checkedOut ? "Checked out" : "Confirm check-out"}</Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">Today’s record</p><h3 className="mt-1 text-xl font-bold text-fg">{record.employee_name}</h3><p className="text-sm text-fg-muted">{record.employee_role || "Employee"}</p></div>
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${checkedIn ? "bg-success/10 text-success" : "bg-raised text-fg-subtle"}`}>{checkedIn ? <CheckCircle2 className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <TimeCard label="Check-in" value={record.check_in} icon={LogIn} />
          <TimeCard label="Check-out" value={record.check_out} icon={LogOut} />
        </div>
        <div className="mt-4 rounded-xl bg-raised/60 p-4">
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-fg">Status</span></div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={checkedIn ? "success" : isAway ? "warning" : "outline"}>{record.status.replace("_", " ")}</Badge>{record.confirmed_by_employee && <Badge variant="default">Self-confirmed</Badge>}</div>
          {record.notes && <p className="mt-3 text-sm text-fg-muted">{record.notes}</p>}
        </div>
      </Card>
    </div>
  );
}

function TimeCard({ label, value, icon: Icon }: { label: string; value: string | null; icon: typeof Clock3 }) {
  return <div className="rounded-xl border border-border p-4"><Icon className="h-4 w-4 text-accent" /><p className="mt-2 text-xs uppercase tracking-wide text-fg-subtle">{label}</p><p className="mt-1 text-xl font-bold text-fg">{value || "—"}</p></div>;
}
