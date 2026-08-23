import {
  AlertTriangle,
  ArrowRight,
  CircleUserRound,
  FolderKanban,
  ListChecks,
  UserRoundCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_OPTIONS } from "@/lib/utils";
import type { DeliveryMapProject, DeliveryMapTask } from "@/types";

export function DeliveryMapChart({
  data,
  boardTab,
}: {
  data: DeliveryMapProject[];
  boardTab: "kanban" | "board";
}) {
  const totals = data.reduce(
    (result, project) => ({
      open: result.open + project.total_tasks - project.done_tasks,
      delayed: result.delayed + project.delayed_tasks,
      unassigned: result.unassigned + project.unassigned_tasks,
    }),
    { open: 0, delayed: 0, unassigned: 0 },
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <ListChecks className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-fg">Project delivery map</h2>
              <p className="text-xs text-fg-muted">Project progress, task status and accountable workload in one view</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.length} projects</Badge>
          <Badge variant="neutral">{totals.open} open tasks</Badge>
          {totals.delayed > 0 && <Badge variant="danger">{totals.delayed} delayed</Badge>}
          {totals.unassigned > 0 && <Badge variant="warning">{totals.unassigned} unassigned</Badge>}
        </div>
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
          <p className="mt-1 text-xs text-fg-muted">Actual projects will appear here when delivery work is available.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.map((project) => (
            <ProjectDeliveryRow key={project.project_id} project={project} boardTab={boardTab} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProjectDeliveryRow({
  project,
  boardTab,
}: {
  project: DeliveryMapProject;
  boardTab: "kanban" | "board";
}) {
  const boardHref = `/projects/${project.project_id}?tab=${boardTab}`;
  const attentionCount = project.delayed_tasks + project.blocked_tasks;

  return (
    <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link className="group inline-flex items-center gap-2 font-semibold text-fg hover:text-accent" to={boardHref}>
              <span className="truncate">{project.project_name}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span className="inline-flex items-center gap-1">
                <UserRoundCheck className="h-3.5 w-3.5" />
                PM: {project.project_manager_name ?? "Not assigned"}
              </span>
              <span>{project.done_tasks}/{project.total_tasks} complete</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {attentionCount > 0 && <Badge variant="danger">{attentionCount} attention</Badge>}
            <span className="text-lg font-bold text-fg">{project.progress_pct}%</span>
          </div>
        </div>

        <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-raised" aria-label={`${project.project_name} task status graph`}>
          {project.total_tasks > 0 ? (
            TASK_STATUS_OPTIONS.map((status) => {
              const count = project.status_counts[status] ?? 0;
              if (count === 0) return null;
              return (
                <Link
                  key={status}
                  to={boardHref}
                  className="h-full transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  style={{
                    backgroundColor: STATUS_COLORS[status],
                    minWidth: "6px",
                    width: `${(count / project.total_tasks) * 100}%`,
                  }}
                  title={`${count} ${TASK_STATUS_LABELS[status]} tasks in ${project.project_name}`}
                  aria-label={`Open ${count} ${TASK_STATUS_LABELS[status]} tasks in ${project.project_name}`}
                />
              );
            })
          ) : (
            <span className="flex w-full items-center justify-center text-[10px] text-fg-subtle">No tasks</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {project.assignees.length > 0 ? (
            project.assignees.slice(0, 6).map((assignee) => (
              <Link
                key={assignee.member_id}
                to={`${boardHref}&assignee=${assignee.member_id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-accent/50 hover:text-accent"
                title={`Filter ${project.project_name} by ${assignee.name}`}
              >
                <CircleUserRound className="h-3.5 w-3.5" />
                <span>{assignee.name}</span>
                <strong className="font-semibold text-fg">{assignee.open_tasks}</strong>
                {assignee.delayed_tasks > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
              </Link>
            ))
          ) : (
            <span className="text-xs text-fg-subtle">No assigned employees</span>
          )}
          {project.assignees.length > 6 && <Badge variant="outline">+{project.assignees.length - 6} people</Badge>}
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-raised/35 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Priority tasks</p>
          {project.unassigned_tasks > 0 && <Badge variant="warning">{project.unassigned_tasks} unassigned</Badge>}
        </div>
        {project.attention_tasks.length === 0 ? (
          <p className="py-3 text-xs text-fg-muted">No open tasks in this project.</p>
        ) : (
          <div className="space-y-1.5">
            {project.attention_tasks.slice(0, 3).map((task) => (
              <PriorityTaskLink key={task.task_id} projectId={project.project_id} boardTab={boardTab} task={task} />
            ))}
            {project.attention_tasks.length > 3 && (
              <Link className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-accent hover:underline" to={boardHref}>
                View more priority work <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityTaskLink({
  projectId,
  boardTab,
  task,
}: {
  projectId: number;
  boardTab: "kanban" | "board";
  task: DeliveryMapTask;
}) {
  return (
    <Link
      to={`/projects/${projectId}?tab=${boardTab}&milestone=${task.milestone_id}&task=${task.task_id}`}
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface"
      title={`Open ${task.title} in ${task.milestone_title}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[task.status] }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-fg group-hover:text-accent">{task.title}</span>
        <span className="block truncate text-[11px] text-fg-subtle">
          {task.assignee_names.length > 0 ? task.assignee_names.join(", ") : "Unassigned"}
          {task.end_date ? ` · ${formatDate(task.end_date)}` : ""}
        </span>
      </span>
      {task.is_delayed && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Delayed" />}
    </Link>
  );
}
