import { ClipboardCheck, Inbox, UserRoundCheck } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { CoverageInbox } from "@/components/attendance/CoverageInbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useCoverageOffers, useLeaveRequests } from "@/hooks/useLeaveRequests";
import { AttendancePage } from "@/pages/AttendancePage";
import { LeaveRequestsPage } from "@/pages/LeaveRequestsPage";

type HubSection = "attendance" | "leave" | "coverage";

export function AttendanceHubPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requests = useLeaveRequests(isAdmin ? "all" : "mine");
  const offers = useCoverageOffers("pending");
  const requestedSection = searchParams.get("section");
  const section: HubSection = requestedSection === "leave" || requestedSection === "coverage"
    ? requestedSection
    : "attendance";
  const pendingCount = useMemo(
    () => (requests.data ?? []).filter((request) => request.status === "pending").length,
    [requests.data],
  );

  function selectSection(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "leave" || value === "coverage") next.set("section", value);
    else next.delete("section");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
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
          <TabsTrigger value="coverage" className="flex-1 gap-2 px-4 sm:flex-none">
            <UserRoundCheck className="h-4 w-4" />
            Coverage inbox
            {!!offers.data?.length && (
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                {offers.data.length}
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
        <TabsContent value="coverage">
          <CoverageInbox />
        </TabsContent>
      </Tabs>
    </div>
  );
}
