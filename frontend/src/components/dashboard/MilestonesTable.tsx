/**
 * dashboard/MilestonesTable.tsx
 * Read-only milestone overview. Each row expands to lazily load its tasks.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { RiskBadge } from "@/components/common/RiskBadge";
import { TaskStatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useTasks } from "@/hooks/useTasks";
import { formatDate } from "@/lib/utils";
import type { Milestone } from "@/types";

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const [open, setOpen] = useState(false);
  const { data: tasks, isLoading } = useTasks(milestone.id, open);

  return (
    <>
      <tr className="border-b border-border/60">
        <td className="py-2 pr-2">
          <button
            className="flex items-center gap-1 text-left text-fg hover:text-accent"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {milestone.title}
          </button>
        </td>
        <td className="py-2 pr-4 text-fg-muted">{formatDate(milestone.end_date)}</td>
        <td className="w-40 py-2 pr-4">
          <div className="flex items-center gap-2">
            <Progress value={milestone.progress_pct} className="w-24" />
            <span className="text-xs text-fg-muted">{milestone.progress_pct}%</span>
          </div>
        </td>
        <td className="py-2 pr-4 text-fg-muted">
          {milestone.done_tasks}/{milestone.total_tasks}
        </td>
        <td className="py-2 pr-4">
          <RiskBadge risk={milestone.risk_level} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-raised/40 px-4 py-2">
            {isLoading && <Skeleton className="h-8 w-full" />}
            {tasks && tasks.length === 0 && (
              <p className="py-2 text-sm text-fg-subtle">No tasks in this milestone.</p>
            )}
            {tasks && tasks.length > 0 && (
              <ul className="flex flex-col gap-1 py-1">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-fg">{t.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-fg-subtle">{t.assigned_member_name ?? "—"}</span>
                      <TaskStatusBadge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function MilestonesTable({ milestones }: { milestones: Milestone[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestones</CardTitle>
      </CardHeader>
      <CardContent>
        {milestones.length === 0 ? (
          <EmptyState title="No milestones yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-fg-subtle">
                  <th className="py-2 pr-2 font-medium">Milestone</th>
                  <th className="py-2 pr-4 font-medium">Deadline</th>
                  <th className="py-2 pr-4 font-medium">Progress</th>
                  <th className="py-2 pr-4 font-medium">Tasks</th>
                  <th className="py-2 pr-4 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <MilestoneRow key={m.id} milestone={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
