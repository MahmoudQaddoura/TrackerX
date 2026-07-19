/**
 * project/KanbanBoard.tsx
 * The admin/PM/developer work surface — a Jira-style board with one
 * swimlane per milestone and 5 status columns. Admin/PM manage milestones
 * and tasks here (this replaces the old Milestones & Tasks tab for them);
 * developers can only drag cards between columns, and never into/out of
 * Done (server-enforced too — this is UX, not the source of truth).
 */
import { AlertTriangle, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CommentThread } from "@/components/common/CommentThread";
import { DelayBadge, RiskBadge } from "@/components/common/RiskBadge";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { MilestoneFormDialog } from "@/components/forms/MilestoneFormDialog";
import { TaskFormDialog } from "@/components/forms/TaskFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useAuth } from "@/context/AuthContext";
import { useMilestoneMutations, useMilestones } from "@/hooks/useMilestones";
import { useProjectTasks, useTaskMutations } from "@/hooks/useTasks";
import { cn, formatDate, TASK_STATUS_LABELS, TASK_STATUS_OPTIONS } from "@/lib/utils";
import type { Milestone, Project, Task, TaskStatus } from "@/types";

const DONE: TaskStatus = "done";

export function KanbanBoard({ project }: { project: Project }) {
  const { canManage, isDeveloper } = useAuth();
  const milestones = useMilestones(project.id);
  const tasks = useProjectTasks(project.id);
  const taskMut = useTaskMutations(project.id);
  const msMut = useMilestoneMutations(project.id);

  const [dragError, setDragError] = useState<string | null>(null);
  const [msFormOpen, setMsFormOpen] = useState(false);
  const [editingMs, setEditingMs] = useState<Milestone | undefined>();
  const [msToDelete, setMsToDelete] = useState<Milestone | null>(null);

  const tasksByMilestone = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of tasks.data ?? []) {
      const list = map.get(t.milestone_id) ?? [];
      list.push(t);
      map.set(t.milestone_id, list);
    }
    return map;
  }, [tasks.data]);

  function canDrag(task: Task): boolean {
    if (canManage) return true;
    if (isDeveloper) return task.status !== DONE;
    return false;
  }

  function canDropIn(status: TaskStatus): boolean {
    if (canManage) return true;
    if (isDeveloper) return status !== DONE;
    return false;
  }

  async function moveTask(taskId: number, status: TaskStatus) {
    try {
      await taskMut.changeStatus.mutateAsync({ id: taskId, status });
      setDragError(null);
    } catch {
      setDragError("That move isn't allowed for your account.");
      setTimeout(() => setDragError(null), 4000);
    }
  }

  if (milestones.isLoading || tasks.isLoading) return <Skeleton className="h-96 w-full" />;
  if (milestones.isError || tasks.isError)
    return <ErrorState message="Could not load the board." onRetry={() => { milestones.refetch(); tasks.refetch(); }} />;

  return (
    <div className="flex flex-col gap-4">
      {dragError && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {dragError}
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditingMs(undefined);
              setMsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add milestone
          </Button>
        </div>
      )}

      {milestones.data?.length === 0 && (
        <EmptyState title="No milestones yet" description={canManage ? "Add one to start planning." : undefined} />
      )}

      {milestones.data?.map((milestone) => (
        <MilestoneSwimlane
          key={milestone.id}
          project={project}
          milestone={milestone}
          tasks={tasksByMilestone.get(milestone.id) ?? []}
          canDrag={canDrag}
          canDropIn={canDropIn}
          onMoveTask={moveTask}
          onEditMilestone={() => {
            setEditingMs(milestone);
            setMsFormOpen(true);
          }}
          onDeleteMilestone={() => setMsToDelete(milestone)}
        />
      ))}

      <MilestoneFormDialog
        open={msFormOpen}
        onOpenChange={setMsFormOpen}
        milestone={editingMs}
        project={project}
        isPending={msMut.create.isPending || msMut.update.isPending}
        onSubmit={(payload) =>
          editingMs ? msMut.update.mutateAsync({ id: editingMs.id, payload }) : msMut.create.mutateAsync(payload)
        }
      />
      <DeleteConfirmDialog
        open={!!msToDelete}
        onOpenChange={(o) => !o && setMsToDelete(null)}
        title="Delete milestone"
        description={`Delete "${msToDelete?.title}" and all its tasks?`}
        isPending={msMut.remove.isPending}
        onConfirm={() => {
          if (msToDelete) msMut.remove.mutate(msToDelete.id, { onSuccess: () => setMsToDelete(null) });
        }}
      />
    </div>
  );
}

function MilestoneSwimlane({
  project,
  milestone,
  tasks,
  canDrag,
  canDropIn,
  onMoveTask,
  onEditMilestone,
  onDeleteMilestone,
}: {
  project: Project;
  milestone: Milestone;
  tasks: Task[];
  canDrag: (task: Task) => boolean;
  canDropIn: (status: TaskStatus) => boolean;
  onMoveTask: (taskId: number, status: TaskStatus) => void;
  onEditMilestone: () => void;
  onDeleteMilestone: () => void;
}) {
  const { canManage } = useAuth();
  const taskMut = useTaskMutations(project.id);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const s of TASK_STATUS_OPTIONS) map.set(s, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    return map;
  }, [tasks]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div>
          <h3 className="font-semibold text-fg">{milestone.title}</h3>
          <p className="text-xs text-fg-subtle">
            {formatDate(milestone.start_date)} → {formatDate(milestone.end_date)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={milestone.progress_pct} className="w-40" />
            <span className="text-xs text-fg-muted">
              {milestone.done_tasks}/{milestone.total_tasks} · {milestone.progress_pct}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge risk={milestone.risk_level} />
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingTask(undefined);
                  setTaskFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add task
              </Button>
              <Button variant="ghost" size="icon" aria-label="Edit milestone" onClick={onEditMilestone}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete milestone" onClick={onDeleteMilestone}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-x-auto p-4 sm:grid-cols-2 lg:grid-cols-5">
        {TASK_STATUS_OPTIONS.map((status) => {
          const dropOk = canDropIn(status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                if (!dropOk) return;
                e.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                if (!dropOk) return;
                const taskId = Number(e.dataTransfer.getData("text/plain"));
                if (taskId) onMoveTask(taskId, status);
              }}
              className={cn(
                "flex min-h-[80px] flex-col gap-2 rounded-md border border-border/60 bg-raised/40 p-2",
                dragOverStatus === status && dropOk && "border-accent bg-accent-soft",
                !dropOk && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase text-fg-subtle">
                  {TASK_STATUS_LABELS[status]}
                </span>
                <span className="text-xs text-fg-subtle">{byStatus.get(status)?.length ?? 0}</span>
              </div>
              {byStatus.get(status)?.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={canDrag(task)}
                  showComments={canManage}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(task.id))}
                  onClick={() => {
                    if (canManage) {
                      setEditingTask(task);
                      setTaskFormOpen(true);
                    } else {
                      setDetailTask(task);
                    }
                  }}
                  onComment={(e) => {
                    e.stopPropagation();
                    setCommentTask(task);
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {canManage && (
        <TaskFormDialog
          open={taskFormOpen}
          onOpenChange={setTaskFormOpen}
          task={editingTask}
          isPending={taskMut.create.isPending || taskMut.update.isPending}
          onSubmit={(payload) =>
            editingTask
              ? taskMut.update.mutateAsync({ id: editingTask.id, milestoneId: milestone.id, payload })
              : taskMut.create.mutateAsync({ milestoneId: milestone.id, payload })
          }
        />
      )}

      <TaskDetailDialog task={detailTask} onOpenChange={(o) => !o && setDetailTask(null)} />

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

function TaskCard({
  task,
  draggable,
  showComments,
  onDragStart,
  onClick,
  onComment,
}: {
  task: Task;
  draggable: boolean;
  showComments: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
  onComment: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2.5 text-left shadow-sm transition-colors hover:border-accent/60",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium text-fg">{task.title}</p>
        {showComments && (
          <Button variant="ghost" size="icon" aria-label="Comments" className="h-6 w-6 shrink-0" onClick={onComment}>
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {task.assigned_member_name ? (
          <Badge variant="neutral">
            {task.assigned_member_name}
          </Badge>
        ) : (
          <Badge variant="neutral">Unassigned</Badge>
        )}
        {task.est_days != null && <Badge variant="outline">{task.est_days}d</Badge>}
      </div>
      <div className="flex items-center gap-1.5">
        <RiskBadge risk={task.risk_level} />
        <DelayBadge delayed={task.is_delayed} />
      </div>
    </div>
  );
}

function TaskDetailDialog({
  task,
  onOpenChange,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task?.title}</DialogTitle>
        </DialogHeader>
        {task && (
          <div className="flex flex-col gap-3 text-sm">
            {task.description && <p className="text-fg-muted">{task.description}</p>}
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">
                {task.assigned_member_name ?? "Unassigned"}
              </Badge>
              {task.est_days != null && <Badge variant="outline">{task.est_days}d estimate</Badge>}
              <RiskBadge risk={task.risk_level} />
              <DelayBadge delayed={task.is_delayed} />
            </div>
            {task.is_delayed && task.delay_comment && (
              <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-2 text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{task.delay_comment}</span>
              </div>
            )}
            <p className="text-xs text-fg-subtle">
              {formatDate(task.start_date)} → {formatDate(task.end_date)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
