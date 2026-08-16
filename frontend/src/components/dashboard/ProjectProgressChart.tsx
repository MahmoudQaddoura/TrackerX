import { AlertTriangle, ArrowRight, FolderKanban } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import type { ProjectTimelineItem } from "@/types";

export function ProjectProgressChart({
  data,
  onProjectSelect,
}: {
  data: ProjectTimelineItem[];
  onProjectSelect?: (projectId: number) => void;
}) {
  const rows = [...data].sort((a, b) => Number(b.is_delayed) - Number(a.is_delayed) || a.progress_pct - b.progress_pct);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Project health</CardTitle>
          <p className="mt-1 text-xs text-fg-muted">Open a project to manage its Kanban, documents, and Gantt</p>
        </div>
        <Badge variant="neutral">{rows.length} projects</Badge>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title="No projects yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <button
                key={row.project_id}
                type="button"
                onClick={() => onProjectSelect?.(row.project_id)}
                className="group rounded-xl border border-border/75 p-3 text-left transition-colors hover:border-accent/35 hover:bg-raised/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <FolderKanban className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-fg">{row.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {row.is_delayed && <AlertTriangle className="h-4 w-4 text-danger" />}
                        <span className="text-sm font-semibold text-fg">{row.progress_pct}%</span>
                      </span>
                    </div>
                    <Progress
                      className="mt-2"
                      value={row.progress_pct}
                      indicatorClassName={row.is_delayed ? "bg-danger" : undefined}
                    />
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
