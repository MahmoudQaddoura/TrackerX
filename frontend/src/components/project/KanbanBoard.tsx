/**
 * project/KanbanBoard.tsx
 * The admin/PM/developer work surface — a Jira-style board with one
 * swimlane per milestone and 5 status columns. Admin/PM manage milestones
 * and tasks here (this replaces the old Milestones & Tasks tab for them);
 * developers can only drag cards between columns, and never into/out of
 * Done (server-enforced too — this is UX, not the source of truth).
 */
import {
  Activity,
  AlertTriangle,
  Download,
  FileText,
  Headphones,
  LifeBuoy,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

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

type WorkstreamSection = {
  key: MilestoneWorkstream;
  title: string;
  description: string;
  addLabel: string;
  icon: LucideIcon;
  canAdd?: boolean;
  primary?: boolean;
  emptyDescription: string;
};

const DELIVERY_SECTION: WorkstreamSection =
  {
    key: "project",
    title: "Project Delivery",
    description: "Implementation milestones that deliver the project scope.",
    addLabel: "Add delivery milestone",
    icon: Rocket,
    primary: true,
    emptyDescription: "Add a delivery milestone to start planning the project.",
  };

const LEGACY_OPERATIONS_SECTION: WorkstreamSection =
  {
    key: "operations",
    title: "Legacy Operations",
    description: "Existing operational milestones retained from before Maintenance & Support workspaces.",
    addLabel: "Add operations milestone",
    icon: Wrench,
    canAdd: false,
    emptyDescription: "Create a separate Maintenance & Support workspace for ongoing service work.",
  };

const SUPPORT_SECTIONS: WorkstreamSection[] = [
  {
    key: "operations",
    title: "Proactive Maintenance",
    description: "Planned health checks, patching, security testing, performance, and KPI reviews.",
    addLabel: "Add proactive cycle",
    icon: Activity,
    primary: true,
    emptyDescription: "Add a planned maintenance cycle for recurring preventive work.",
  },
  {
    key: "project",
    title: "Reactive Support",
    description: "Incidents, client requests, defects, escalations, and corrective actions.",
    addLabel: "Add reactive queue",
    icon: Headphones,
    emptyDescription: "Add a reactive queue for incidents and on-demand support requests.",
  },
];

export function KanbanBoard({ project }: { project: Project }) {
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
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const isSupport = project.project_type === "maintenance_support";
  const hasLegacyOperations = (milestones.data ?? []).some(
    (milestone) => milestone.workstream === "operations",
  );
  const workstreamSections = isSupport
    ? SUPPORT_SECTIONS
    : hasLegacyOperations
      ? [DELIVERY_SECTION, LEGACY_OPERATIONS_SECTION]
      : [DELIVERY_SECTION];

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

      {isSupport && (
        <div className="grid gap-3 rounded-xl border border-accent/25 bg-accent-soft/35 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-accent" />
              <h2 className="font-display font-semibold text-fg">Maintenance &amp; Support workspace</h2>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              Plan preventive work under Proactive Maintenance and capture on-demand work under
              Reactive Support. Click any task to assign people, set dates, or update details.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success"><Activity className="h-3.5 w-3.5" /> Proactive · planned</Badge>
            <Badge variant="warning"><Headphones className="h-3.5 w-3.5" /> Reactive · on demand</Badge>
          </div>
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
        const sectionMilestones = (milestones.data ?? []).filter(
          (milestone) => milestone.workstream === section.key,
        );
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
              {canManage && section.canAdd !== false && (
                <Button
                  size="sm"
                  variant={section.primary ? "default" : "outline"}
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
              sectionMilestones.map((milestone) => (
                <MilestoneSwimlane
                  key={milestone.id}
                  project={project}
                  milestone={milestone}
                  tasks={tasksByMilestone.get(milestone.id) ?? []}
                  documents={documentsByMilestone.get(milestone.id) ?? []}
                  canDrag={canDrag}
                  canDropIn={canDropIn}
                  onMoveTask={moveTask}
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
  canDrag,
  canDropIn,
  onMoveTask,
  onEditMilestone,
  onDeleteMilestone,
}: {
  project: Project;
  milestone: Milestone;
  tasks: Task[];
  documents: DocumentMeta[];
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
    <Card id={`milestone-${milestone.id}`} className="scroll-mt-20">
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
                          {placement.collection === "project" ? "Actual Project" : "Maintenance & Operations"}
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
  const assignees = task.assigned_members?.length
    ? task.assigned_members
    : task.assigned_member_id != null && task.assigned_member_name
      ? [{ id: task.assigned_member_id, name: task.assigned_member_name, role: null }]
      : [];

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
