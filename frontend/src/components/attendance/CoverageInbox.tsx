import { ArrowRight, CheckCircle2, ClipboardCheck, Inbox, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoverageOffers, useRespondToCoverageOffer } from "@/hooks/useLeaveRequests";
import { getApiErrorMessage } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import type { CoverageSeverity } from "@/types";

const SEVERITY_VARIANT: Record<CoverageSeverity, "default" | "warning" | "danger" | "outline"> = {
  critical: "danger",
  high: "warning",
  medium: "default",
  low: "outline",
};

export function CoverageInbox({ compact = false }: { compact?: boolean }) {
  const offers = useCoverageOffers("pending");
  const respond = useRespondToCoverageOffer();
  const [responding, setResponding] = useState<{ id: number; action: "accepted" | "declined" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(offerId: number, action: "accepted" | "declined") {
    setResponding({ id: offerId, action });
    setError(null);
    try {
      await respond.mutateAsync({ offerId, action });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not respond to this coverage request."));
    } finally {
      setResponding(null);
    }
  }

  if (offers.isLoading) return compact ? <Skeleton className="h-28" /> : <Skeleton className="h-48" />;
  if (offers.isError) return compact ? null : <ErrorState message="Could not load task coverage requests." onRetry={() => offers.refetch()} />;
  if (!offers.data?.length) {
    return compact ? null : <EmptyState icon={Inbox} title="No coverage requests" description="Task coverage assignments will appear here when an administrator sends one." />;
  }

  return (
    <Card className={compact ? "overflow-hidden border-accent/30" : "overflow-hidden"}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent-soft/40 px-5 py-4">
        <div><h2 className="flex items-center gap-2 font-semibold text-fg"><ClipboardCheck className="h-4.5 w-4.5 text-accent" />Task coverage requests</h2><p className="mt-1 text-xs text-fg-muted">Review the workload and accept only when you can take ownership.</p></div>
        <Badge variant="warning">{offers.data.length} waiting</Badge>
      </div>
      {error && <p className="border-b border-danger/20 bg-danger/10 px-5 py-2 text-sm text-danger">{error}</p>}
      <CardContent className="divide-y divide-border p-0">
        {offers.data.map((offer) => (
          <div key={offer.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={SEVERITY_VARIANT[offer.severity]}>{offer.severity}</Badge><h3 className="font-medium text-fg">{offer.task_title}</h3></div>
                <p className="mt-1 text-xs text-fg-muted">{offer.project_name} · {offer.milestone_name}</p>
                <p className="mt-2 text-sm text-fg-muted">Covering for <span className="font-medium text-fg">{offer.from_member_name}</span> during {formatDate(offer.leave_start_date)} — {formatDate(offer.leave_end_date)}.</p>
                {offer.admin_note && <p className="mt-2 rounded-md bg-raised px-3 py-2 text-sm text-fg">{offer.admin_note}</p>}
                <p className="mt-2 text-xs text-fg-subtle">Due {formatDate(offer.due_date)} · {offer.est_days ?? "—"} estimated days · Assigned by {offer.assigned_by_name || "Administrator"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild><Link to={`/projects/${offer.project_id}`}>Open project <ArrowRight className="h-4 w-4" /></Link></Button>
                <Button variant="outline" size="sm" disabled={respond.isPending} onClick={() => answer(offer.id, "declined")}><XCircle className="h-4 w-4" />{responding?.id === offer.id && responding.action === "declined" ? "Saving..." : "Decline"}</Button>
                <Button size="sm" disabled={respond.isPending} onClick={() => answer(offer.id, "accepted")}><CheckCircle2 className="h-4 w-4" />{responding?.id === offer.id && responding.action === "accepted" ? "Saving..." : "Accept task"}</Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
