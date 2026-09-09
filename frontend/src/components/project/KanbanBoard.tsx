/**
 * project/KanbanBoard.tsx
 * The admin/PM/developer work surface — a Jira-style board with one
 * swimlane per milestone and 5 status columns. Admin/PM manage milestones
 * and tasks here (this replaces the old Milestones & Tasks tab for them);
 * developers can only drag cards between columns, and never into/out of
 * Done (server-enforced too — this is UX, not the source of truth).
 */
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Download,
  FileText,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { downloadDocument } from "@/api/documents";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useDocuments } from "@/hooks/useDocuments";
import { useMilestoneMutations, useMilestones } from "@/hooks/useMilestones";
import { useProjectTasks, useTaskMutations } from "@/hooks/useTasks";
import { getApiErrorMessage } from "@/lib/apiClient";
import { getDocumentFolder, getDocumentPlacement } from "@/lib/documentFolders";
import { cn, formatDate, TASK_STATUS_LABELS, TASK_STATUS_OPTIONS } from "@/lib/utils";
import type {
  DocumentMeta,
  Milestone,
  MilestoneWorkstream,
  Project,
  Task,
  TaskStatus,
} from "@/types";

const DONE: TaskStatus = "done";

const STATUS_COLUMN_STYLES: Record<
  TaskStatus,
  { panel: string; marker: string; count: string }
> = {
  todo: {
    panel: "border-border bg-raised/35",
    marker: "bg-fg-subtle",
    count: "bg-raised text-fg-muted",
  },
  in_progress: {
    panel: "border-accent/25 bg-accent-soft/35",
    marker: "bg-accent",
    count: "bg-accent-soft text-accent",
  },
  blocked: {
    panel: "border-danger/20 bg-danger/5",
    marker: "bg-danger",
    count: "bg-danger/10 text-danger",
  },
  in_review: {
    panel: "border-warning/25 bg-warning/5",
    marker: "bg-warning",
    count: "bg-warning/10 text-warning",
  },
  done: {
    panel: "border-success/20 bg-success/5",
    marker: "bg-success",
    count: "bg-success/10 text-success",
  },
};

function isMilestoneComplete(milestone: Milestone): boolean {
  return milestone.total_tasks > 0 && milestone.done_tasks >= milestone.total_tasks;
}

type WorkstreamSection = {
  key: MilestoneWorkstream;
  title: string;
  description: string;
  addLabel: string;
  icon: LucideIcon;
  emptyDescription: string;
};

const DELIVERY_SECTION: WorkstreamSection =
  {
    key: "project",
    title: "Project Delivery",
    description: "Implementation milestones that deliver the project scope.",
    addLabel: "Add delivery milestone",
    icon: Rocket,
    emptyDescription: "Add a delivery milestone to start planning the project.",
  };

export function KanbanBoard({
  project,
  focusTaskId,
  initialAssigneeId,
}: {
  project: Project;
  focusTaskId?: number;
  initialAssigneeId?: number;
}) {
  const { canManage, canWrite, isDeveloper } = useAuth();
  const milestones = useMilestones(project.id);
  const tasks = useProjectTasks(project.id);
  const documents = useDocuments(project.id);
  const taskMut = useTaskMutations(project.id);
  const msMut = useMilestoneMutations(project.id);

  const [dragError, setDragError] = useState<string | null>(null);
  const [msFormOpen, setMsFormOpen] = useState(false);
  const [editingMs, setEditingMs] = useState<Milestone | undefined>();
  const [newMilestoneWorkstream, setNewMilestoneWorkstream] =
    useState<MilestoneWorkstream>("project");
  const [msToDelete, setMsToDelete] = useState<Milestone | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState(
    initialAssigneeId ? String(initialAssigneeId) : "",
  );
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<number | null>(null);

  const currentMilestoneId = useMemo(() => {
    const ordered = (milestones.data ?? [])
      .filter((milestone) => milestone.workstream === DELIVERY_SECTION.key)
      .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
    return ordered.find((milestone) => !isMilestoneComplete(milestone))?.id ?? null;
  }, [milestones.data]);

  useEffect(() => {
    setAssigneeFilter(initialAssigneeId ? String(initialAssigneeId) : "");
  }, [initialAssigneeId]);

  useEffect(() => {
    setExpandedMilestoneId(currentMilestoneId);
  }, [currentMilestoneId]);

  useEffect(() => {
    if (!focusTaskId || !tasks.data?.some((task) => task.id === focusTaskId)) return;
    const focusedTask = tasks.data.find((task) => task.id === focusTaskId);
    if (focusedTask) setExpandedMilestoneId(focusedTask.milestone_id);
    const timer = window.setTimeout(() => {
      document.getElementById(`task-${focusTaskId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [focusTaskId, tasks.data]);

  const workstreamSections = [DELIVERY_SECTION];

  const assigneeOptions = useMemo(() => {
    const options = new Map<number, string>();
    for (const task of tasks.data ?? []) {
      for (const member of task.assigned_members ?? []) options.set(member.id, member.name);
      if (task.assigned_member_id != null && task.assigned_member_name) {
        options.set(task.assigned_member_id, task.assigned_member_name);
      }
    }
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tasks.data]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const selectedAssignee = assigneeFilter ? Number(assigneeFilter) : null;
    return (tasks.data ?? []).filter((task) => {
      const members = task.assigned_members?.length
        ? task.assigned_members
        : task.assigned_member_id != null && task.assigned_member_name
          ? [{ id: task.assigned_member_id, name: task.assigned_member_name, role: null }]
          : [];
      const matchesAssignee =
        selectedAssignee == null || members.some((member) => member.id === selectedAssignee);
      const matchesQuery =
        !normalizedQuery ||
        `${task.title} ${task.description ?? ""} ${members.map((member) => member.name).join(" ")}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return matchesAssignee && matchesQuery;
    });
  }, [assigneeFilter, searchQuery, tasks.data]);

  const tasksByMilestone = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of visibleTasks) {
      const list = map.get(t.milestone_id) ?? [];
      list.push(t);
      map.set(t.milestone_id, list);
    }
    return map;
  }, [visibleTasks]);

  const documentsByMilestone = useMemo(() => {
    const map = new Map<number, DocumentMeta[]>();
    for (const document of documents.data ?? []) {
      if (document.milestone_id == null) continue;
      const list = map.get(document.milestone_id) ?? [];
      list.push(document);
      map.set(document.milestone_id, list);
    }
    return map;
  }, [documents.data]);

  function canDrag(task: Task): boolean {
    if (canManage) return true;
    if (isDeveloper && canWrite) return task.status !== DONE;
    return false;
  }

  function canDropIn(status: TaskStatus): boolean {
    if (canManage) return true;
    if (isDeveloper && canWrite) return status !== DONE;
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

  if (milestones.isLoading || tasks.isLoading || documents.isLoading)
    return <Skeleton className="h-96 w-full" />;
  if (milestones.isError || tasks.isError || documents.isError)
    return (
      <ErrorState
        message="Could not load the board."
        onRetry={() => {
          milestones.refetch();
          tasks.refetch();
          documents.refetch();
        }}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {dragError && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {dragError}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks, descriptions, or assignees…"
              aria-label="Search Kanban tasks"
              className="pl-9"
            />
          </div>
          <Select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            aria-label="Filter Kanban by assignee"
          >
            <option value="">All assignees</option>
            {assigneeOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <span className="text-xs font-medium text-fg-muted">
            Showing {visibleTasks.length} of {tasks.data?.length ?? 0} tasks
          </span>
          {(searchQuery || assigneeFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setAssigneeFilter("");
              }}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {workstreamSections.map((section) => {
        const SectionIcon = section.icon;
        const sectionMilestones = (milestones.data ?? [])
          .filter((milestone) => milestone.workstream === section.key)
          .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
        const sectionTaskCount = sectionMilestones.reduce(
          (total, milestone) => total + (tasksByMilestone.get(milestone.id)?.length ?? 0),
          0,
        );
        return (
          <section key={section.key} className="flex flex-col gap-3" aria-labelledby={`${section.key}-kanban-title`}>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <SectionIcon className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`${section.key}-kanban-title`} className="font-display text-base font-semibold text-fg">
                      {section.title}
                    </h2>
                    <Badge variant="neutral">{sectionMilestones.length} milestones</Badge>
                    <Badge variant="outline">{sectionTaskCount} visible tasks</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-fg-muted">{section.description}</p>
                </div>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setEditingMs(undefined);
                    setNewMilestoneWorkstream(section.key);
                    setMsFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> {section.addLabel}
                </Button>
              )}
            </div>

            {sectionMilestones.length === 0 ? (
              <EmptyState
                icon={SectionIcon}
                title={`No ${section.title.toLocaleLowerCase()} milestones yet`}
                description={
                  canManage ? section.emptyDescription : undefined
                }
              />
            ) : (
              sectionMilestones.map((milestone, index) => (
                <MilestoneSwimlane
                  key={milestone.id}
                  project={project}
                  milestone={milestone}
                  tasks={tasksByMilestone.get(milestone.id) ?? []}
                  documents={documentsByMilestone.get(milestone.id) ?? []}
                  sequenceNumber={index + 1}
                  sequenceTotal={sectionMilestones.length}
                  isComplete={isMilestoneComplete(milestone)}
                  isCurrent={milestone.id === currentMilestoneId}
                  isExpanded={milestone.id === expandedMilestoneId}
                  focusTaskId={focusTaskId}
                  canDrag={canDrag}
                  canDropIn={canDropIn}
                  onMoveTask={moveTask}
                  onToggle={() =>
                    setExpandedMilestoneId((current) =>
                      current === milestone.id ? null : milestone.id,
                    )
                  }
                  onEditMilestone={() => {
                    setEditingMs(milestone);
                    setMsFormOpen(true);
                  }}
                  onDeleteMilestone={() => setMsToDelete(milestone)}
                />
              ))
            )}
          </section>
        );
      })}

      <MilestoneFormDialog
        open={msFormOpen}
        onOpenChange={setMsFormOpen}
        milestone={editingMs}
        project={project}
        defaultWorkstream={newMilestoneWorkstream}
        sequenceNumber={
          editingMs
            ? (milestones.data ?? [])
                .filter((milestone) => milestone.workstream === editingMs.workstream)
                .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
                .findIndex((milestone) => milestone.id === editingMs.id) + 1
            : (milestones.data ?? []).filter(
                (milestone) => milestone.workstream === newMilestoneWorkstream,
              ).length + 1
        }
        suggestedSortOrder={
          Math.max(
            -1,
            ...(milestones.data ?? [])
              .filter((milestone) => milestone.workstream === newMilestoneWorkstream)
              .map((milestone) => milestone.sort_order),
          ) + 1
        }
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
  documents,
  sequenceNumber,
  sequenceTotal,
  isComplete,
  isCurrent,
  isExpanded,
  focusTaskId,
  canDrag,
  canDropIn,
  onMoveTask,
  onToggle,
  onEditMilestone,
  onDeleteMilestone,
}: {
  project: Project;
  milestone: Milestone;
  tasks: Task[];
  documents: DocumentMeta[];
  sequenceNumber: number;
  sequenceTotal: number;
  isComplete: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  focusTaskId?: number;
  canDrag: (task: Task) => boolean;
  canDropIn: (status: TaskStatus) => boolean;
  onMoveTask: (taskId: number, status: TaskStatus) => void;
  onToggle: () => void;
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
    <Card
      id={`milestone-${milestone.id}`}
      className={cn(
        "scroll-mt-20 overflow-hidden transition-shadow",
        isCurrent && "border-accent/35 shadow-card",
        isComplete && "border-success/25",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3",
          isCurrent && "bg-accent-soft/45",
          isComplete && "bg-success/5",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isExpanded}
          aria-controls={`milestone-board-${milestone.id}`}
          onClick={onToggle}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-display text-sm font-bold",
              isComplete
                ? "border-success/20 bg-success/10 text-success"
                : isCurrent
                  ? "border-accent/20 bg-accent text-accent-fg"
                  : "border-border bg-surface text-fg-muted",
            )}
          >
            {isComplete ? <CheckCircle2 className="h-5 w-5" /> : sequenceNumber}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-display font-semibold text-fg">{milestone.title}</span>
              {isComplete ? (
                <Badge variant="success">Done</Badge>
              ) : isCurrent ? (
                <Badge variant="default"><CircleDot className="h-3 w-3" /> Current</Badge>
              ) : (
                <Badge variant="neutral">Up next</Badge>
              )}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
              <span>Milestone {sequenceNumber} of {sequenceTotal}</span>
              <span>{formatDate(milestone.start_date)} → {formatDate(milestone.end_date)}</span>
              <span>{milestone.done_tasks}/{milestone.total_tasks} tasks</span>
            </span>
            <span className="mt-2 flex max-w-xl items-center gap-2">
              <Progress
                value={milestone.progress_pct}
                className="h-1.5 flex-1 bg-surface"
                indicatorClassName={isComplete ? "bg-success" : "bg-accent"}
              />
              <span className={cn("w-9 text-right text-xs font-semibold", isComplete ? "text-success" : "text-accent")}>
                {milestone.progress_pct}%
              </span>
            </span>
          </span>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-accent" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-fg-subtle" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <RiskBadge risk={milestone.risk_level} />
          <MilestoneDocumentsButton milestone={milestone} documents={documents} />
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

      {isExpanded && <div
        id={`milestone-board-${milestone.id}`}
        className="grid grid-cols-1 gap-3 overflow-x-auto bg-bg/45 p-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {TASK_STATUS_OPTIONS.map((status) => {
          const dropOk = canDropIn(status);
          const statusStyle = STATUS_COLUMN_STYLES[status];
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
                "flex min-h-28 flex-col gap-2 rounded-lg border p-2.5",
                statusStyle.panel,
                dragOverStatus === status && dropOk && "border-accent bg-accent-soft",
                !dropOk && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between px-0.5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  <span className={cn("h-2 w-2 rounded-full", statusStyle.marker)} />
                  {TASK_STATUS_LABELS[status]}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", statusStyle.count)}>
                  {byStatus.get(status)?.length ?? 0}
                </span>
              </div>
              {byStatus.get(status)?.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  highlighted={task.id === focusTaskId}
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
      </div>}

      {canManage && (
        <TaskFormDialog
          open={taskFormOpen}
          onOpenChange={setTaskFormOpen}
          task={editingTask}
          milestone={milestone}
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

function MilestoneDocumentsButton({
  milestone,
  documents,
}: {
  milestone: Milestone;
  documents: DocumentMeta[];
}) {
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (documents.length === 0) return null;

  async function handleDownload(document: DocumentMeta) {
    setDownloadingId(document.id);
    setDownloadError(null);
    try {
      await downloadDocument(document);
    } catch (error) {
      setDownloadError(getApiErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Paperclip className="h-4 w-4" />
        {documents.length} {documents.length === 1 ? "file" : "files"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{milestone.title} documents</DialogTitle>
            <DialogDescription>
              Files tagged to this milestone from Document control.
            </DialogDescription>
          </DialogHeader>

          {downloadError && <p className="text-sm text-danger">{downloadError}</p>}

          <ul className="overflow-hidden rounded-lg border border-border">
            {documents.map((document) => {
              const placement = getDocumentPlacement(document);
              const folder = getDocumentFolder(placement.collection, placement.folder);
              return (
                <li
                  key={document.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-raised text-fg-muted">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{document.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          {placement.collection === "project" ? "Actual Project" : "Maintenance & Support"}
                        </Badge>
                        <Badge variant="neutral">{folder?.label ?? "Document"}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${document.title}`}
                    title="Download"
                    onClick={() => handleDownload(document)}
                    disabled={downloadingId === document.id}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskCard({
  task,
  highlighted,
  draggable,
  showComments,
  onDragStart,
  onClick,
  onComment,
}: {
  task: Task;
  highlighted: boolean;
  draggable: boolean;
  showComments: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
  onComment: (e: React.MouseEvent) => void;
}) {
  const assignees = task.assigned_members?.length
    ? task.assigned_members
    : task.assigned_member_id != null && task.assigned_member_name
      ? [{ id: task.assigned_member_id, name: task.assigned_member_name, role: null }]
      : [];

  return (
    <div
      id={`task-${task.id}`}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "scroll-mt-24 flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2.5 text-left shadow-sm transition-colors hover:border-accent/60",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        highlighted && "border-accent ring-2 ring-accent/25",
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
        {assignees.length === 0 ? (
          <Badge variant="neutral">Unassigned</Badge>
        ) : (
          <>
            {assignees.slice(0, 2).map((member) => (
              <Badge key={member.id} variant="neutral" title={member.role ?? undefined}>
                {member.name}
              </Badge>
            ))}
            {assignees.length > 2 && (
              <Badge variant="outline" title={assignees.slice(2).map((member) => member.name).join(", ")}>
                +{assignees.length - 2}
              </Badge>
            )}
          </>
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
              {task.assigned_members?.length ? (
                task.assigned_members.map((member) => (
                  <Badge key={member.id} variant="neutral">
                    {member.name}
                  </Badge>
                ))
              ) : (
                <Badge variant="neutral">{task.assigned_member_name ?? "Unassigned"}</Badge>
              )}
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
