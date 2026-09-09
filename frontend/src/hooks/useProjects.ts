/** hooks/useProjects.ts — project queries + mutations. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProject,
  deleteProject,
  fetchProject,
  fetchProjects,
  fetchProjectTeam,
  importProjectCsv,
  updateProject,
  updateProjectManager,
  updateProjectTeam,
  type ProjectManagerPayload,
  type ProjectPayload,
} from "@/api/projects";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
}

export function useProject(id: number) {
  return useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id), enabled: !!id });
}

export function useProjectTeam(id: number, enabled = true) {
  return useQuery({ queryKey: ["project-team", id], queryFn: () => fetchProjectTeam(id), enabled: !!id && enabled });
}

export function useProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const create = useMutation({ mutationFn: (p: ProjectPayload) => createProject(p), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProjectPayload }) => updateProject(id, payload),
    onSuccess: (_d, v) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["project", v.id] });
      qc.invalidateQueries({ queryKey: ["gantt", v.id] });
    },
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteProject(id), onSuccess: invalidate });
  const importCsv = useMutation({ mutationFn: (file: File) => importProjectCsv(file), onSuccess: invalidate });
  const updateManager = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProjectManagerPayload }) =>
      updateProjectManager(id, payload),
    onSuccess: (_data, variables) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["project", variables.id] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
  const updateTeam = useMutation({
    mutationFn: ({ id, memberIds }: { id: number; memberIds: number[] }) => updateProjectTeam(id, memberIds),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["project-team", variables.id] });
      qc.invalidateQueries({ queryKey: ["project", variables.id] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });

  return { create, update, remove, importCsv, updateManager, updateTeam };
}
