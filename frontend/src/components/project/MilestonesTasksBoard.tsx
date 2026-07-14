/**
 * project/MilestonesTasksBoard.tsx
 * Read-only progress view for the `client` role: milestones with their
 * tasks, status, and risk. Admin/PM manage milestones/tasks from the
 * Kanban tab instead — this view never shows edit affordances.
 */
import { MessageSquare } from "lucide-react";
import { useState } from "react";

import { CommentThread } from "@/components/common/CommentThread";
import { RiskBadge } from "@/components/common/RiskBadge";
import { TaskStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMilestones } from "@/hooks/useMilestones";
import { useTasks } from "@/hooks/useTasks";
import { formatDate } from "@/lib/utils";
import type { Milestone, Project, Task } from "@/types";

export function MilestonesTasksBoard({ project }: { project: Project }) {
  const { data: milestones, isLoading, isError, refetch } = useMilestones(project.id);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError) return <ErrorState message="Could not load milestones." onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      {milestones && milestones.length === 0 && <EmptyState title="No milestones yet" />}

      {milestones?.map((milestone) => (
        <MilestoneCard key={milestone.id} milestone={milestone} />
      ))}
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const { data: tasks, isLoading } = useTasks(milestone.id);
  const [commentTask, setCommentTask] = useState<Task | null>(null);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-fg">{milestone.title}</h3>
            <p className="text-xs text-fg-subtle">
              {formatDate(milestone.start_date)} → {formatDate(milestone.end_date)}
            </p>
          </div>
          <RiskBadge risk={milestone.risk_level} />
        </div>
        <div className="flex items-center gap-2">
          <Progress value={milestone.progress_pct} className="w-40" />
          <span className="text-xs text-fg-muted">
            {milestone.done_tasks}/{milestone.total_tasks} · {milestone.progress_pct}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading && <Skeleton className="h-10 w-full" />}
        {tasks && tasks.length === 0 && (
          <p className="py-2 text-sm text-fg-subtle">No tasks yet.</p>
        )}
        {tasks?.map((task) => (
          <div
            key={task.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{task.title}</p>
              <p className="text-xs text-fg-subtle">
                {task.assigned_member_name ?? "Unassigned"}
                {task.end_date ? ` · due ${formatDate(task.end_date)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <RiskBadge risk={task.risk_level} />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Comments"
                onClick={() => setCommentTask(task)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!commentTask} onOpenChange={(o) => !o && setCommentTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comments · {commentTask?.title}</DialogTitle>
          </DialogHeader>
          {commentTask && <CommentThread entityType="task" entityId={commentTask.id} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
