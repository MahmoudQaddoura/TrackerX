import { CalendarCheck2, ClipboardCheck, Inbox } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { AttendancePage } from "@/pages/AttendancePage";
import { LeaveRequestsPage } from "@/pages/LeaveRequestsPage";

type HubSection = "attendance" | "leave";

export function AttendanceHubPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requests = useLeaveRequests(isAdmin ? "all" : "mine");
  const section: HubSection = searchParams.get("section") === "leave" ? "leave" : "attendance";
  const pendingCount = useMemo(
    () => (requests.data ?? []).filter((request) => request.status === "pending").length,
    [requests.data],
  );

  function selectSection(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "leave") next.set("section", "leave");
    else next.delete("section");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-accent/15 bg-gradient-to-r from-accent-soft via-surface to-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
              <CalendarCheck2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold text-fg">Attendance &amp; leave</h1>
              <p className="mt-1 text-sm text-fg-muted">
                {isAdmin
                  ? "Manage the daily sheet and employee absence requests in one workspace."
                  : "Review your attendance and submit leave or absence reasons in one place."}
              </p>
            </div>
          </div>
          {isAdmin && pendingCount > 0 && (
            <Badge variant="warning" className="px-3 py-1.5">
              {pendingCount} request{pendingCount === 1 ? "" : "s"} waiting
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={section} onValueChange={selectSection}>
        <TabsList className="w-full justify-start p-1.5 sm:w-auto">
          <TabsTrigger value="attendance" className="flex-1 gap-2 px-4 sm:flex-none">
            <ClipboardCheck className="h-4 w-4" />
            {isAdmin ? "Daily attendance" : "My attendance"}
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex-1 gap-2 px-4 sm:flex-none">
            <Inbox className="h-4 w-4" />
            {isAdmin ? "Request inbox" : "Leave requests"}
            {isAdmin && pendingCount > 0 && (
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <AttendancePage embedded />
        </TabsContent>
        <TabsContent value="leave">
          <LeaveRequestsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
