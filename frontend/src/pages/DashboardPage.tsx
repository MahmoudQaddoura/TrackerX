/**
 * pages/DashboardPage.tsx
 * Portfolio-wide executive view: KPI tiles, two charts, and the delays table.
 * Each region renders its own skeleton/error so one failure doesn't blank the page.
 */
import { AlertTriangle, CheckCircle2, FolderKanban, TrendingUp } from "lucide-react";

import { DelaysTable } from "@/components/dashboard/DelaysTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectProgressChart } from "@/components/dashboard/ProjectProgressChart";
import { StatusBreakdownChart } from "@/components/dashboard/StatusBreakdownChart";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDelayedTasks,
  useProjectTimelines,
  useStatusBreakdown,
  useSummary,
} from "@/hooks/useAnalytics";

export function DashboardPage() {
  const summary = useSummary();
  const status = useStatusBreakdown();
  const timelines = useProjectTimelines();
  const delayed = useDelayedTasks();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-fg">Dashboard</h1>
        <p className="text-sm text-fg-muted">Portfolio health across all projects.</p>
      </div>

      {/* KPI row */}
      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary.isError ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : (
        summary.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Active projects" value={`${summary.data.active_projects}/${summary.data.total_projects}`} icon={FolderKanban} />
            <KpiCard label="Overall progress" value={`${summary.data.progress_pct}%`} icon={TrendingUp} />
            <KpiCard label="Completed tasks" value={`${summary.data.done_tasks}/${summary.data.total_tasks}`} icon={CheckCircle2} accent="success" />
            <KpiCard
              label="Delayed tasks"
              value={summary.data.delayed_tasks}
              icon={AlertTriangle}
              accent={summary.data.delayed_tasks > 0 ? "danger" : "default"}
            />
          </div>
        )
      )}

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {status.isLoading ? (
          <Skeleton className="h-80" />
        ) : status.isError ? (
          <ErrorState onRetry={() => status.refetch()} />
        ) : (
          status.data && <StatusBreakdownChart data={status.data} />
        )}

        {timelines.isLoading ? (
          <Skeleton className="h-80" />
        ) : timelines.isError ? (
          <ErrorState onRetry={() => timelines.refetch()} />
        ) : (
          timelines.data && <ProjectProgressChart data={timelines.data} />
        )}
      </div>

      {/* Delays table */}
      {delayed.isLoading ? (
        <Skeleton className="h-48" />
      ) : delayed.isError ? (
        <ErrorState onRetry={() => delayed.refetch()} />
      ) : (
        delayed.data && <DelaysTable data={delayed.data} />
      )}
    </div>
  );
}
