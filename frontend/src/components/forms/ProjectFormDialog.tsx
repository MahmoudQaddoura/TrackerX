/** forms/ProjectFormDialog.tsx — create/edit a delivery or support project. */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, LifeBuoy, Link2, Sparkles } from "lucide-react";

import { type ProjectPayload } from "@/api/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn, PROJECT_STATUS_LABELS, toInputDate } from "@/lib/utils";
import type { Project, ProjectType } from "@/types";

const STATUSES = ["active", "on_hold", "completed", "archived"];

const PROJECT_TYPE_OPTIONS: {
  value: ProjectType;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}[] = [
  {
    value: "actual_project",
    title: "Actual Project",
    description: "Plan and deliver a defined project scope through milestones and tasks.",
    icon: BriefcaseBusiness,
  },
  {
    value: "maintenance_support",
    title: "Maintenance & Support",
    description: "Run proactive service care and respond to incidents or client requests.",
    icon: LifeBuoy,
  },
];

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  availableProjects = [],
  defaultProjectType = "actual_project",
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
  availableProjects?: Project[];
  defaultProjectType?: ProjectType;
  onSubmit: (payload: ProjectPayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [projectType, setProjectType] = useState<ProjectType>(defaultProjectType);
  const [parentProjectId, setParentProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const actualProjects = useMemo(() => {
    const options = availableProjects.filter(
      (candidate) => candidate.project_type === "actual_project" && candidate.id !== project?.id,
    );
    if (
      project?.parent_project_id &&
      project.parent_project_name &&
      !options.some((candidate) => candidate.id === project.parent_project_id)
    ) {
      return [
        ...options,
        {
          ...project,
          id: project.parent_project_id,
          name: project.parent_project_name,
          project_type: "actual_project" as const,
        },
      ];
    }
    return options;
  }, [availableProjects, project]);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setStatus(project?.status ?? "active");
      setProjectType(project?.project_type ?? defaultProjectType);
      setParentProjectId(project?.parent_project_id ? String(project.parent_project_id) : "");
      setStartDate(toInputDate(project?.start_date));
      setEndDate(toInputDate(project?.end_date));
      setGithubRepo(project?.github_repo_url ?? "");
      setError(null);
    }
  }, [defaultProjectType, open, project]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (startDate && endDate && startDate > endDate)
      return setError("Start date must be on or before end date.");
    try {
      await onSubmit({
        name: name.trim(),
        description: description || null,
        status,
        project_type: projectType,
        parent_project_id:
          projectType === "maintenance_support" && parentProjectId
            ? Number(parentProjectId)
            : null,
        start_date: startDate || null,
        end_date: endDate || null,
        github_repo_url: githubRepo.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  const selectedType = PROJECT_TYPE_OPTIONS.find((option) => option.value === projectType)!;
  const SelectedTypeIcon = selectedType.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "Create a new workspace"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!project ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">What are you managing?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROJECT_TYPE_OPTIONS.map((option) => {
                  const TypeIcon = option.icon;
                  const selected = projectType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setProjectType(option.value);
                        if (option.value === "actual_project") setParentProjectId("");
                      }}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                        selected
                          ? "border-accent bg-accent-soft ring-1 ring-accent"
                          : "border-border bg-surface hover:border-accent/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          selected ? "bg-accent text-accent-fg" : "bg-raised text-fg-muted",
                        )}
                      >
                        <TypeIcon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-fg">{option.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-fg-muted">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-raised/50 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
                <SelectedTypeIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">{selectedType.title}</p>
                <p className="text-xs text-fg-muted">Workspace type is fixed after creation.</p>
              </div>
            </div>
          )}

          {projectType === "maintenance_support" && (
            <div className="flex flex-col gap-2 rounded-lg border border-accent/25 bg-accent-soft/40 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-fg">
                <Link2 className="h-4 w-4 text-accent" />
                <Label htmlFor="p-parent">Related actual project</Label>
                <Badge variant="outline">Optional</Badge>
              </div>
              <Select
                id="p-parent"
                value={parentProjectId}
                onChange={(event) => setParentProjectId(event.target.value)}
              >
                <option value="">Standalone maintenance &amp; support</option>
                {actualProjects.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
              <p className="flex items-start gap-1.5 text-xs leading-5 text-fg-muted">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                Six structured proactive report templates and a reactive incident register will
                be created automatically.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                projectType === "maintenance_support"
                  ? "e.g. Client platform support 2027"
                  : "e.g. Client portal implementation"
              }
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add the scope, objectives, or service agreement summary."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-status">Status</Label>
            <Select id="p-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-start">Start date</Label>
              <Input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-end">End date</Label>
              <Input id="p-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-repo">GitHub repo URL</Label>
            <Input id="p-repo" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="https://github.com/org/repo" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />} {project ? "Save changes" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
