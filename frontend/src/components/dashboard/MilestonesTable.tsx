import { CalendarDays, Flag } from "lucide-react";

import { RiskBadge } from "@/components/common/RiskBadge";
import { TaskHoverPreview } from "@/components/dashboard/TaskHoverPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import type { Milestone, Task } from "@/types";

export function MilestonesTable({
  milestones,
  tasks,
  isLoadingTasks = false,
}: {
  milestones: Milestone[];
  tasks: Task[];
  isLoadingTasks?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Milestone progress</CardTitle>
          <p className="mt-1 text-xs text-fg-muted">Hover a milestone to see its tasks and assignees.</p>
        </div>
        <span className="rounded-lg bg-raised px-3 py-1.5 text-sm font-semibold text-fg">{milestones.length}</span>
      </CardHeader>
      <CardContent>
        {milestones.length === 0 ? (
          <EmptyState title="No milestones yet" />
        ) : (
          <div className="space-y-2">
            {milestones.map((milestone, index) => {
              const milestoneTasks = tasks.filter((task) => task.milestone_id === milestone.id);
              return (
                <div
                  key={milestone.id}
                  className="group relative z-0 rounded-xl border border-border/70 bg-surface px-3 py-3 transition hover:z-40 hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-sm focus-within:z-40"
                >
                  <div tabIndex={0} className="grid cursor-default items-center gap-3 outline-none sm:grid-cols-[minmax(0,1fr)_100px_82px]" aria-label={`${milestone.title}, ${milestone.progress_pct}% complete`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-sm font-bold text-accent">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">{milestone.title}</p>
                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-fg-subtle">
                          <CalendarDays className="h-3 w-3" /> {formatDate(milestone.end_date)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-fg-muted">
                        <span>{milestone.done_tasks}/{milestone.total_tasks} tasks</span>
                        <span className="font-semibold text-fg">{milestone.progress_pct}%</span>
                      </div>
                      <Progress value={milestone.progress_pct} />
                    </div>
                    <div className="flex justify-end"><RiskBadge risk={milestone.risk_level} /></div>
                  </div>

                  <div className="pointer-events-none invisible absolute left-3 right-3 top-[calc(100%-4px)] z-50 translate-y-1 opacity-0 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <TaskHoverPreview
                      title={milestone.title}
                      tasks={milestoneTasks}
                      milestones={milestones}
                      isLoading={isLoadingTasks}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {milestones.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-fg-subtle"><Flag className="h-3 w-3" /> Progress is calculated from the tasks inside each milestone.</p>
        )}
      </CardContent>
    </Card>
  );
}
