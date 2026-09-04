import { ListTodo, UserRound } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Milestone, Task } from "@/types";

export function TaskHoverPreview({
  title,
  tasks,
  milestones,
  isLoading = false,
}: {
  title: string;
  tasks: Task[];
  milestones: Milestone[];
  isLoading?: boolean;
}) {
  const milestoneNames = new Map(milestones.map((milestone) => [milestone.id, milestone.title]));

  return (
    <div className="rounded-xl border border-accent/20 bg-surface/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <ListTodo className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </span>
        <span className="shrink-0 rounded-full bg-raised px-2.5 py-1 text-[11px] font-semibold text-fg-muted">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2 pt-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-4 text-center text-xs text-fg-subtle">No tasks in this group.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {tasks.slice(0, 5).map((task) => {
            const assignees = task.assigned_members?.length
              ? task.assigned_members.map((member) => member.name)
              : task.assigned_member_name
                ? [task.assigned_member_name]
                : [];
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-raised/65 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-fg">{task.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
                    {milestoneNames.get(task.milestone_id) ?? "Milestone"}
                  </p>
                </div>
                <div className="flex max-w-[46%] shrink-0 items-center gap-1.5 text-[11px] text-fg-muted">
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="truncate" title={assignees.join(", ") || "Unassigned"}>
                    {assignees.join(", ") || "Unassigned"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > 5 && (
        <p className="mt-2 text-right text-[11px] font-medium text-accent">+{tasks.length - 5} more tasks</p>
      )}
    </div>
  );
}
