/** common/StatusBadge.tsx — badges for task and project status. */
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/utils";
import type { ProjectStatus, TaskStatus } from "@/types";

const TASK_VARIANT: Record<TaskStatus, "default" | "neutral" | "success" | "warning" | "danger"> = {
  todo: "neutral",
  in_progress: "default",
  in_review: "default",
  blocked: "warning",
  done: "success",
};

const PROJECT_VARIANT: Record<string, "default" | "neutral" | "success" | "warning"> = {
  active: "default",
  on_hold: "warning",
  completed: "success",
  archived: "neutral",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_VARIANT[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={PROJECT_VARIANT[status] ?? "neutral"}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}
