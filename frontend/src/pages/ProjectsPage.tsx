/** pages/ProjectsPage.tsx — lifecycle portfolio for delivery, support, and archive. */
import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleAlert,
  FolderKanban,
  Gauge,
  LifeBuoy,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { ProjectPayload } from "@/api/projects";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ProjectStatusBadge } from "@/components/common/StatusBadge";
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
  const { create, update } = useProjectMutations();
  const team = useTeam(true, isPrimaryAdmin);
  const [formOpen, setFormOpen] = useState(false);
  const [managerProject, setManagerProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const portfolio = useMemo(() => {
    const projects = data ?? [];
    return {
      actual: projects.filter(
        (project) => project.project_type === "actual_project" && !FINISHED_STATUSES.has(project.status),
      ),
      support: projects.filter(
        (project) => project.project_type === "maintenance_support" && !FINISHED_STATUSES.has(project.status),
      ),
      archive: projects.filter((project) => FINISHED_STATUSES.has(project.status)),
    };
  }, [data]);

  const visiblePortfolio = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filter = (projects: Project[]) => projects.filter((project) =>
      !query || [project.name, project.description, project.project_manager_name, project.parent_project_name]
        .some((value) => value?.toLowerCase().includes(query)),
    );
    return {
      actual: filter(portfolio.actual),
      support: filter(portfolio.support),
      archive: filter(portfolio.archive),
    };
  }, [portfolio, searchQuery]);

  const liveProjects = [...portfolio.actual, ...portfolio.support];
  const managedCount = liveProjects.filter((project) => project.project_manager_id != null).length;
  const attentionCount = liveProjects.filter(
    (project) => project.is_delayed || project.risk_level === "at_risk" || project.risk_level === "overdue",
  ).length;
  const averageProgress = liveProjects.length
    ? Math.round(liveProjects.reduce((sum, project) => sum + project.progress_pct, 0) / liveProjects.length)
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-2xl border border-accent/20 bg-surface shadow-lg">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#073b5c] via-accent to-[#1d729a] px-5 py-6 text-white sm:px-7">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[34px] border-white/5" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                <FolderKanban className="h-3.5 w-3.5" /> Portfolio command center
              </span>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Project portfolio</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                See delivery health, accountable leadership, support work, and completed engagements in one operational view.
              </p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button className="bg-white text-accent hover:bg-white/90" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> New project
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <PortfolioMetric icon={BriefcaseBusiness} label="Live workspaces" value={liveProjects.length} hint={`${portfolio.actual.length} delivery · ${portfolio.support.length} support`} />
          <PortfolioMetric icon={ShieldCheck} label="Named leadership" value={`${managedCount}/${liveProjects.length}`} hint={managedCount === liveProjects.length ? "Every project has a lead" : `${liveProjects.length - managedCount} need an accountable lead`} tone={managedCount === liveProjects.length ? "success" : "default"} />
          <PortfolioMetric icon={Gauge} label="Average progress" value={`${averageProgress}%`} hint="Across active workspaces" />
          <PortfolioMetric icon={CircleAlert} label="Needs attention" value={attentionCount} hint={attentionCount ? "Delayed or at-risk work" : "No active delivery alerts"} tone={attentionCount ? "warning" : "success"} />
        </div>
      </section>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      )}
      {isError && <ErrorState message="Could not load projects." onRetry={() => refetch()} />}

      {data && (
        <Tabs defaultValue="actual" className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                <PortfolioTab value="actual" icon={BriefcaseBusiness} label="Actual Projects" count={portfolio.actual.length} />
                <PortfolioTab value="support" icon={LifeBuoy} label="Maintenance & Support" count={portfolio.support.length} />
                <PortfolioTab value="archive" icon={Archive} label="Archive" count={portfolio.archive.length} />
              </TabsList>
              <label className="relative block w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search project, lead, or client link..." className="h-10 w-full rounded-lg border border-border bg-raised/70 pl-9 pr-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
              </label>
            </div>
          </div>

          <TabsContent value="actual">
            <ProjectCollection projects={visiblePortfolio.actual} icon={BriefcaseBusiness} emptyTitle={searchQuery ? "No matching actual projects" : "No active actual projects"} emptyDescription={searchQuery ? "Try a different project, lead, or linked workspace name." : isAdmin ? "Create an Actual Project to begin planning delivery milestones." : "No delivery projects are assigned to you."} onOpen={(id) => navigate(`/projects/${id}`)} isAdmin={isAdmin} canAssignManager={isPrimaryAdmin} onAssignManager={setManagerProject} onGitHubSave={(project, payload) => update.mutateAsync({ id: project.id, payload })} />
          </TabsContent>
          <TabsContent value="support">
            <ProjectCollection projects={visiblePortfolio.support} icon={LifeBuoy} emptyTitle={searchQuery ? "No matching support workspaces" : "No active maintenance & support workspaces"} emptyDescription={searchQuery ? "Try a different project, lead, or linked workspace name." : isAdmin ? "Create a Maintenance & Support workspace and link it to an actual project, or run it independently." : "No support workspaces are assigned to you."} onOpen={(id) => navigate(`/projects/${id}`)} isAdmin={isAdmin} canAssignManager={isPrimaryAdmin} onAssignManager={setManagerProject} onGitHubSave={(project, payload) => update.mutateAsync({ id: project.id, payload })} />
          </TabsContent>
          <TabsContent value="archive">
            <ProjectCollection projects={visiblePortfolio.archive} icon={Archive} emptyTitle={searchQuery ? "No matching archived projects" : "Archive is empty"} emptyDescription={searchQuery ? "Try a different project, lead, or linked workspace name." : "Completed and archived projects will appear here automatically."} onOpen={(id) => navigate(`/projects/${id}`)} isAdmin={isAdmin} canAssignManager={isPrimaryAdmin} onAssignManager={setManagerProject} onGitHubSave={(project, payload) => update.mutateAsync({ id: project.id, payload })} />
          </TabsContent>
        </Tabs>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} availableProjects={data ?? []} onSubmit={(payload) => create.mutateAsync(payload)} isPending={create.isPending} />
      <ProjectManagerDialog project={managerProject} members={team.data ?? []} onClose={() => setManagerProject(null)} />
    </div>
  );
}

function PortfolioMetric({ icon: Icon, label, value, hint, tone = "default" }: { icon: LucideIcon; label: string; value: string | number; hint: string; tone?: "default" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-accent-soft text-accent";
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0"><span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{label}</span><span className="mt-0.5 block text-xl font-bold text-fg">{value}</span><span className="block truncate text-xs text-fg-muted">{hint}</span></span>
    </div>
  );
}

function PortfolioTab({ value, icon: Icon, label, count }: { value: string; icon: LucideIcon; label: string; count: number }) {
  return (
    <TabsTrigger value={value} className="group gap-2 whitespace-nowrap">
      <Icon className="h-4 w-4" /> {label}
      <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-fg-muted group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{count}</span>
    </TabsTrigger>
  );
}

function ProjectCollection({ projects, icon, emptyTitle, emptyDescription, onOpen, isAdmin, canAssignManager, onAssignManager, onGitHubSave }: { projects: Project[]; icon: LucideIcon; emptyTitle: string; emptyDescription: string; onOpen: (id: number) => void; isAdmin: boolean; canAssignManager: boolean; onAssignManager: (project: Project) => void; onGitHubSave: (project: Project, payload: ProjectPayload) => Promise<unknown> }) {
  if (projects.length === 0) return <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const isSupport = project.project_type === "maintenance_support";
        const TypeIcon = isSupport ? LifeBuoy : FolderKanban;
        return (
          <Card key={project.id} className="relative overflow-hidden border-border/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-lg">
            <span className={`absolute inset-x-0 top-0 h-1 ${isSupport ? "bg-success" : "bg-accent"}`} />
            <CardContent className="flex h-full flex-col p-5 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isSupport ? "bg-success/10 text-success" : "bg-accent-soft text-accent"}`}><TypeIcon className="h-5 w-5" /></span>
                  <div className="min-w-0"><Badge variant="outline" className="mb-1 text-[10px]">{isSupport ? "Maintenance & Support" : "Actual Project"}</Badge><h2 className="truncate text-lg font-bold text-fg" title={project.name}>{project.name}</h2></div>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>

              <p className="mt-3 min-h-10 line-clamp-2 text-sm leading-relaxed text-fg-muted">{project.description || "No project summary has been added yet."}</p>
              {isSupport && <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/15 bg-success/5 px-3 py-2 text-xs text-fg-muted"><Link2 className="h-3.5 w-3.5 shrink-0 text-success" /><span className="truncate">{project.parent_project_name ? `Linked to ${project.parent_project_name}` : "Standalone support workspace"}</span></div>}

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-raised/55 p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${project.project_manager_id ? "bg-accent text-white" : "bg-warning/10 text-warning"}`}><UserRoundCog className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Project lead</span><span className="block truncate text-sm font-semibold text-fg">{project.project_manager_name ?? "Not assigned"}</span></span>
                {canAssignManager && <Button type="button" variant="outline" size="sm" onClick={() => onAssignManager(project)}><UserRoundCog className="h-3.5 w-3.5" /> {project.project_manager_id ? "Change" : "Assign"}</Button>}
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-surface">
                <ProjectFact label="Tasks" value={`${project.done_tasks}/${project.total_tasks}`} />
                <ProjectFact label="Milestones" value={project.milestone_count} />
                <div className="flex min-w-0 flex-col items-center justify-center px-2 py-2.5"><span className="text-[10px] uppercase tracking-wide text-fg-subtle">Risk</span><RiskBadge risk={project.risk_level} /></div>
              </div>

              <div className="mt-4"><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-fg-muted">Delivery progress</span><span className="font-bold text-accent">{project.progress_pct}%</span></div><Progress value={project.progress_pct} /></div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-fg-muted">
                <span className="flex min-w-0 items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{formatDate(project.start_date)} → {formatDate(project.end_date)}</span></span>
                <div className="flex shrink-0 items-center gap-1"><ProjectGitHubButton project={project} isAdmin={isAdmin} onSave={(payload) => onGitHubSave(project, payload)} /><Button type="button" size="sm" onClick={() => onOpen(project.id)}>Open <ArrowRight className="h-3.5 w-3.5" /></Button></div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ProjectFact({ label, value }: { label: string; value: string | number }) {
  return <span className="flex flex-col items-center px-2 py-2.5"><span className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span><span className="mt-0.5 font-bold text-fg">{value}</span></span>;
}
