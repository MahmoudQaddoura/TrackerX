/** pages/ProjectsPage.tsx — lifecycle portfolio for delivery, support, and archive. */
import {
  Archive,
  BriefcaseBusiness,
  FolderKanban,
  LifeBuoy,
  Link2,
  MoreHorizontal,
  Plus,
  Upload,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { ProjectPayload } from "@/api/projects";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ProjectStatusBadge } from "@/components/common/StatusBadge";
import { CsvImportDialog } from "@/components/forms/CsvImportDialog";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";
import { ProjectGitHubButton } from "@/components/project/ProjectGitHubButton";
import { ProjectManagerDialog } from "@/components/project/ProjectManagerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useProjectMutations, useProjects } from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeam";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types";

const FINISHED_STATUSES = new Set(["completed", "archived"]);

export function ProjectsPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useProjects();
  const { create, update, importCsv } = useProjectMutations();
  const team = useTeam(true, isPrimaryAdmin);
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [managerProject, setManagerProject] = useState<Project | null>(null);

  const portfolio = useMemo(() => {
    const projects = data ?? [];
    return {
      actual: projects.filter(
        (project) =>
          project.project_type === "actual_project" && !FINISHED_STATUSES.has(project.status),
      ),
      support: projects.filter(
        (project) =>
          project.project_type === "maintenance_support" &&
          !FINISHED_STATUSES.has(project.status),
      ),
      archive: projects.filter((project) => FINISHED_STATUSES.has(project.status)),
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Project portfolio</h1>
          <p className="text-sm text-fg-muted">
            Manage delivery work, ongoing support, and completed engagements in one lifecycle.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4" /> Import actual project
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}
      {isError && <ErrorState message="Could not load projects." onRetry={() => refetch()} />}

      {data && (
        <Tabs defaultValue="actual">
          <TabsList className="w-full justify-start overflow-x-auto">
            <PortfolioTab value="actual" icon={BriefcaseBusiness} label="Actual Projects" count={portfolio.actual.length} />
            <PortfolioTab value="support" icon={LifeBuoy} label="Maintenance & Support" count={portfolio.support.length} />
            <PortfolioTab value="archive" icon={Archive} label="Archive" count={portfolio.archive.length} />
          </TabsList>

          <TabsContent value="actual">
            <ProjectCollection
              projects={portfolio.actual}
              icon={BriefcaseBusiness}
              emptyTitle="No active actual projects"
              emptyDescription={
                isAdmin
                  ? "Create an Actual Project to begin planning delivery milestones."
                  : "No delivery projects are assigned to you."
              }
              onOpen={(id) => navigate(`/projects/${id}`)}
              isAdmin={isAdmin}
              canAssignManager={isPrimaryAdmin}
              onAssignManager={setManagerProject}
              onGitHubSave={(project, payload) =>
                update.mutateAsync({ id: project.id, payload })
              }
            />
          </TabsContent>

          <TabsContent value="support">
            <ProjectCollection
              projects={portfolio.support}
              icon={LifeBuoy}
              emptyTitle="No active maintenance & support workspaces"
              emptyDescription={
                isAdmin
                  ? "Create a Maintenance & Support workspace and link it to an actual project, or run it independently."
                  : "No support workspaces are assigned to you."
              }
              onOpen={(id) => navigate(`/projects/${id}`)}
              isAdmin={isAdmin}
              canAssignManager={isPrimaryAdmin}
              onAssignManager={setManagerProject}
              onGitHubSave={(project, payload) =>
                update.mutateAsync({ id: project.id, payload })
              }
            />
          </TabsContent>

          <TabsContent value="archive">
            <ProjectCollection
              projects={portfolio.archive}
              icon={Archive}
              emptyTitle="Archive is empty"
              emptyDescription="Completed and archived projects will appear here automatically."
              onOpen={(id) => navigate(`/projects/${id}`)}
              isAdmin={isAdmin}
              canAssignManager={isPrimaryAdmin}
              onAssignManager={setManagerProject}
              onGitHubSave={(project, payload) =>
                update.mutateAsync({ id: project.id, payload })
              }
            />
          </TabsContent>
        </Tabs>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        availableProjects={data ?? []}
        onSubmit={(payload) => create.mutateAsync(payload)}
        isPending={create.isPending}
      />
      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onImport={(file) => importCsv.mutateAsync(file)}
        isPending={importCsv.isPending}
      />
      <ProjectManagerDialog
        project={managerProject}
        members={team.data ?? []}
        onClose={() => setManagerProject(null)}
      />
    </div>
  );
}

function PortfolioTab({
  value,
  icon: Icon,
  label,
  count,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <TabsTrigger value={value} className="group gap-2 whitespace-nowrap">
      <Icon className="h-4 w-4" />
      {label}
      <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-fg-muted group-data-[state=active]:bg-white/20">
        {count}
      </span>
    </TabsTrigger>
  );
}

function ProjectCollection({
  projects,
  icon,
  emptyTitle,
  emptyDescription,
  onOpen,
  isAdmin,
  canAssignManager,
  onAssignManager,
  onGitHubSave,
}: {
  projects: Project[];
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  onOpen: (id: number) => void;
  isAdmin: boolean;
  canAssignManager: boolean;
  onAssignManager: (project: Project) => void;
  onGitHubSave: (project: Project, payload: ProjectPayload) => Promise<unknown>;
}) {
  if (projects.length === 0) {
    return <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const isSupport = project.project_type === "maintenance_support";
        const TypeIcon = isSupport ? LifeBuoy : FolderKanban;
        return (
          <Card
            key={project.id}
            className="group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md"
            onClick={() => onOpen(project.id)}
          >
            <div className={isSupport ? "h-1 bg-success" : "h-1 bg-accent"} />
            <CardContent className="pt-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-raised text-accent">
                    <TypeIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-fg">{project.name}</h3>
                    <p className="text-xs text-fg-muted">
                      {isSupport ? "Maintenance & Support" : "Actual Project"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canAssignManager && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Assign Project Manager for ${project.name}`}
                      title="Assign Project Manager"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAssignManager(project);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                  <ProjectGitHubButton
                    project={project}
                    isAdmin={isAdmin}
                    onSave={(payload) => onGitHubSave(project, payload)}
                  />
                  <ProjectStatusBadge status={project.status} />
                </div>
              </div>

              {isSupport && (
                <div className="mb-3 flex items-center gap-2 rounded-md bg-raised/60 px-2.5 py-2 text-xs text-fg-muted">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {project.parent_project_name
                      ? `Linked to ${project.parent_project_name}`
                      : "Standalone support workspace"}
                  </span>
                </div>
              )}

              <div className="mb-3 grid gap-1.5 rounded-md bg-raised/60 px-2.5 py-2 text-xs text-fg-muted">
                <span className="flex items-center gap-1.5">
                  <UserRoundCog className="h-3.5 w-3.5 text-accent" />
                  <span className="font-medium text-fg">PM:</span> {project.project_manager_name ?? "Not assigned"}
                </span>
              </div>

              {project.description && (
                <p className="mb-3 line-clamp-2 text-sm text-fg-muted">{project.description}</p>
              )}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <RiskBadge risk={project.risk_level} />
                <Badge variant="outline">
                  {project.done_tasks}/{project.total_tasks} tasks
                </Badge>
                <span className="text-xs text-fg-subtle">
                  {project.milestone_count} milestones
                </span>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs text-fg-muted">
                <span>Progress</span>
                <span>{project.progress_pct}%</span>
              </div>
              <Progress value={project.progress_pct} />
              <p className="mt-3 text-xs text-fg-subtle">
                {formatDate(project.start_date)} → {formatDate(project.end_date)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
