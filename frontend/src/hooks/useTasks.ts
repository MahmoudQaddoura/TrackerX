/** hooks/useTasks.ts — task queries + mutations, per-milestone and per-project. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTask,
  deleteTask,
  fetchProjectTasks,
  fetchTasks,
  updateTask,
  updateTaskStatus,
  type TaskPayload,
} from "@/api/tasks";

export function useTasks(milestoneId: number, enabled = true) {
  return useQuery({
    queryKey: ["tasks", milestoneId],
    queryFn: () => fetchTasks(milestoneId),
    enabled: enabled && !!milestoneId,
  });
}

/** All tasks across a project's milestones — feeds the Kanban board. */
export function useProjectTasks(projectId: number, enabled = true) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetchProjectTasks(projectId),
    enabled: enabled && !!projectId,
  });
}

export function useTaskMutations(projectId: number) {
  const qc = useQueryClient();
  const invalidate = (milestoneId?: number) => {
    if (milestoneId) qc.invalidateQueries({ queryKey: ["tasks", milestoneId] });
    qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["gantt", projectId] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const create = useMutation({
    mutationFn: ({ milestoneId, payload }: { milestoneId: number; payload: TaskPayload }) =>
      createTask(milestoneId, payload),
    onSuccess: (_d, v) => invalidate(v.milestoneId),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; milestoneId: number; payload: TaskPayload }) =>
      updateTask(id, payload),
    onSuccess: (_d, v) => invalidate(v.milestoneId),
  });
  const remove = useMutation({
    mutationFn: ({ id }: { id: number; milestoneId: number }) => deleteTask(id),
    onSuccess: (_d, v) => invalidate(v.milestoneId),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTaskStatus(id, status),
    onSuccess: () => invalidate(),
  });

  return { create, update, remove, changeStatus };
}
