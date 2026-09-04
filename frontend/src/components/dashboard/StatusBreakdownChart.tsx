import { useState } from "react";

import { TaskHoverPreview } from "@/components/dashboard/TaskHoverPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/utils";
import type { Milestone, StatusBreakdownItem, Task, TaskStatus } from "@/types";

export function StatusBreakdownChart({
  data,
  tasks,
  milestones,
  isLoadingTasks = false,
}: {
  data: StatusBreakdownItem[];
  tasks: Task[];
  milestones: Milestone[];
  isLoadingTasks?: boolean;
}) {
  const [activeStatus, setActiveStatus] = useState<TaskStatus | null>(null);
  const rows = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      label: TASK_STATUS_LABELS[item.status],
      status: item.status,
      count: item.count,
    }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const activeTasks = activeStatus ? tasks.filter((task) => task.status === activeStatus) : [];

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Task progress</CardTitle>
          <p className="mt-1 text-xs text-fg-muted">Hover a status to see its tasks, milestone, and assignees.</p>
        </div>
        <span className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">{total} tasks</span>
      </CardHeader>
      <CardContent className="relative" onPointerLeave={() => setActiveStatus(null)}>
        {rows.length === 0 ? (
          <EmptyState title="No tasks yet" />
        ) : (
          <>
            <div className="relative pt-2">
              <div className="flex h-5 overflow-hidden rounded-full bg-raised ring-1 ring-border/70">
                {rows.map((row) => (
                  <button
                    key={row.status}
                    type="button"
                    className="relative h-full min-w-2 transition-[filter,transform] hover:z-10 hover:brightness-110 focus:z-10 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                    style={{
                      width: `${(row.count / total) * 100}%`,
                      backgroundColor: STATUS_COLORS[row.status],
                    }}
                    onPointerEnter={() => setActiveStatus(row.status)}
                    onFocus={() => setActiveStatus(row.status)}
                    onBlur={() => setActiveStatus(null)}
                    aria-label={`${row.label}: ${row.count} tasks`}
                  />
                ))}
              </div>
              {activeStatus && (
                <div className="pointer-events-none absolute inset-x-0 top-9 z-50 mx-auto max-w-md">
                  <TaskHoverPreview
                    title={TASK_STATUS_LABELS[activeStatus]}
                    tasks={activeTasks}
                    milestones={milestones}
                    isLoading={isLoadingTasks}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {rows.map((row) => {
                const percentage = Math.round((row.count / total) * 100);
                return (
                  <button
                    key={row.status}
                    type="button"
                    className="group flex items-center justify-between rounded-xl border border-border/70 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    onPointerEnter={() => setActiveStatus(row.status)}
                    onFocus={() => setActiveStatus(row.status)}
                    onBlur={() => setActiveStatus(null)}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full ring-4 ring-raised" style={{ backgroundColor: STATUS_COLORS[row.status] }} />
                      <span>
                        <span className="block text-sm font-medium text-fg">{row.label}</span>
                        <span className="block text-[11px] text-fg-subtle">{percentage}% of project work</span>
                      </span>
                    </span>
                    <span className="font-display text-xl font-bold text-fg">{row.count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
