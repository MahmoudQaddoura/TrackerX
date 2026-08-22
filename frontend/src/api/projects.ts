/** api/projects.ts — project CRUD + CSV import. */
import { api } from "@/lib/apiClient";
import type { Project, ProjectType } from "@/types";

export interface ProjectPayload {
  name: string;
  description?: string | null;
  status?: string;
  project_type?: ProjectType;
  parent_project_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  github_repo_url?: string | null;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>("/projects");
  return data;
}

export async function fetchProject(id: number): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${id}`);
  return data;
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const { data } = await api.post<Project>("/projects", payload);
  return data;
}

export async function updateProject(id: number, payload: ProjectPayload): Promise<Project> {
  const { data } = await api.put<Project>(`/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function importProjectCsv(file: File): Promise<Project> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<Project>("/projects/import-csv", form);
  return data;
}
