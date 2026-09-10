import { BadgeCheck, ClipboardCheck, Inbox, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { AttendanceConfirmation } from "@/components/attendance/AttendanceConfirmation";
import { CoverageInbox } from "@/components/attendance/CoverageInbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useCoverageOffers, useLeaveRequests } from "@/hooks/useLeaveRequests";
import { AttendancePage } from "@/pages/AttendancePage";
import { LeaveRequestsPage } from "@/pages/LeaveRequestsPage";

type HubSection = "confirm" | "attendance" | "leave" | "coverage";

export function AttendanceHubPage() {
  const { isAdmin, isPm, isClient } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canReviewLeave = isAdmin || isPm;
  const requests = useLeaveRequests(canReviewLeave ? "reviewable" : "mine");
  const offers = useCoverageOffers("pending");
  const requestedSection = searchParams.get("section");
  const section: HubSection = ["confirm", "attendance", "leave", "coverage"].includes(requestedSection ?? "")
    ? requestedSection as HubSection
    : "confirm";
  const pendingCount = useMemo(
    () => (requests.data ?? []).filter((request) => request.status === "pending").length,
    [requests.data],
  );

  if (isClient) return <Navigate to="/dashboard" replace />;

  function selectSection(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "confirm") next.delete("section");
    else next.set("section", value);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#073b5c] via-accent to-[#1d729a] px-5 py-6 text-white shadow-lg sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[34px] border-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" /> Attendance control center</span>
            <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Attendance &amp; leave</h1>
            <p className="mt-1.5 text-sm text-white/80">Personal confirmation, attendance oversight, leave approval, and work coverage in one accountable workflow.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
            <p className="font-semibold">Approval route</p>
            <p className="mt-0.5 text-xs text-white/70">Employees → PM or Admin · PM/Admin → Owner</p>
          </div>
        </div>
      </section>

      <Tabs value={section} onValueChange={selectSection}>
        <TabsList className="w-full justify-start overflow-x-auto p-1.5">
          <TabsTrigger value="confirm" className="gap-2 whitespace-nowrap px-4"><BadgeCheck className="h-4 w-4" /> Confirm attendance</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 whitespace-nowrap px-4"><ClipboardCheck className="h-4 w-4" /> {isAdmin ? "Team attendance" : "My record"}</TabsTrigger>
          <TabsTrigger value="leave" className="gap-2 whitespace-nowrap px-4">
            <Inbox className="h-4 w-4" /> {canReviewLeave ? "Leave center" : "Leave requests"}
            {pendingCount > 0 && <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-2 whitespace-nowrap px-4">
            <UserRoundCheck className="h-4 w-4" /> Coverage inbox
            {!!offers.data?.length && <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{offers.data.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="confirm"><AttendanceConfirmation /></TabsContent>
        <TabsContent value="attendance"><AttendancePage embedded /></TabsContent>
        <TabsContent value="leave"><LeaveRequestsPage embedded /></TabsContent>
        <TabsContent value="coverage"><CoverageInbox /></TabsContent>
      </Tabs>
    </div>
  );
}
