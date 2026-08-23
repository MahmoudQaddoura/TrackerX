import { ArrowRight, ChartNoAxesColumnIncreasing, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_OPTIONS } from "@/lib/utils";
import type { DeliveryMapProject } from "@/types";

export function DeliveryMapChart({
  data,
  boardTab,
}: {
  data: DeliveryMapProject[];
  boardTab: "kanban" | "board";
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <ChartNoAxesColumnIncreasing className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">Project progress</h2>
            <p className="text-xs text-fg-muted">Portfolio delivery at a glance</p>
          </div>
        </div>
        <Badge variant="outline">{data.length} projects</Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border bg-raised/35 px-5 py-2.5">
        {TASK_STATUS_OPTIONS.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {TASK_STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <FolderKanban className="mx-auto h-7 w-7 text-fg-subtle" />
          <p className="mt-2 text-sm font-medium text-fg">No active delivery projects</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.map((project) => {
            const boardHref = `/projects/${project.project_id}?tab=${boardTab}`;
            return (
              <Link
                key={project.project_id}
                to={boardHref}
                className="group grid items-center gap-3 px-5 py-4 transition-colors hover:bg-raised/45 sm:grid-cols-[minmax(13rem,0.8fr)_minmax(16rem,1.7fr)_4rem]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg transition-colors group-hover:text-accent">
                    {project.project_name}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {project.done_tasks} of {project.total_tasks} tasks complete
                  </p>
                </div>

                <div
                  className="flex h-3 w-full overflow-hidden rounded-full bg-raised ring-1 ring-border/60"
                  aria-label={`${project.project_name}: ${project.progress_pct}% complete`}
                >
                  {project.total_tasks > 0 ? (
                    TASK_STATUS_OPTIONS.map((status) => {
                      const count = project.status_counts[status] ?? 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={status}
                          className="h-full"
                          style={{
                            backgroundColor: STATUS_COLORS[status],
                            minWidth: "5px",
                            width: `${(count / project.total_tasks) * 100}%`,
                          }}
                          title={`${count} ${TASK_STATUS_LABELS[status]}`}
                        />
                      );
                    })
                  ) : (
                    <span className="w-full" />
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-fg">{project.progress_pct}%</span>
                  <ArrowRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
