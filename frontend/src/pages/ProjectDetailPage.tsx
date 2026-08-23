/**
 * pages/ProjectDetailPage.tsx
 * A single project, tabs scoped per role:
 *   admin/pm  : Overview, Kanban (their work surface), Gantt, Documents, Meetings
 *   developer/client: every approved project tool in read-only mode
 * Admin/pm get edit/delete on the project header; only admin can delete.
 */
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  LifeBuoy,
  ListChecks,
  Percent,
  Pencil,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { RiskBadge } from "@/components/common/RiskBadge";
import { ProjectStatusBadge } from "@/components/common/StatusBadge";
import { DelaysTable } from "@/components/dashboard/DelaysTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MilestonesTable } from "@/components/dashboard/MilestonesTable";
import { StatusBreakdownChart } from "@/components/dashboard/StatusBreakdownChart";
import { DocumentRepository } from "@/components/documents/DocumentRepository";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";
import { GanttChart } from "@/components/gantt/GanttChart";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { MeetingsPanel } from "@/components/meetings/MeetingsPanel";
import { ProjectGitHubButton } from "@/components/project/ProjectGitHubButton";
import { MilestonesTasksBoard } from "@/components/project/MilestonesTasksBoard";
import { MaintenanceSupportDashboard } from "@/components/support/MaintenanceSupportDashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/ui/error-state";
import { FullPageSpinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  useDelayedTasks,
  useGantt,
  useStatusBreakdown,
  useSummary,
} from "@/hooks/useAnalytics";
import { useMilestones } from "@/hooks/useMilestones";
import { useProject, useProjectMutations, useProjects } from "@/hooks/useProjects";
import { formatDate } from "@/lib/utils";
import { ClientProjectWorkspace } from "@/pages/ClientProjectWorkspace";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, isClient, canManage, canEditProjectContent } = useAuth();
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { data: availableProjects } = useProjects();
  const { update, remove } = useProjectMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    resolveProjectTab(searchParams.get("tab"), canEditProjectContent),
  );

  useEffect(() => {
    setActiveTab(resolveProjectTab(searchParams.get("tab"), canEditProjectContent));
  }, [canEditProjectContent, searchParams]);

  useEffect(() => {
    const milestoneId = Number(searchParams.get("milestone"));
    if (!milestoneId || !["kanban", "board"].includes(activeTab)) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`milestone-${milestoneId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [activeTab, searchParams]);

  function openMilestoneFromGantt(milestoneId: number) {
    setActiveTab(canEditProjectContent ? "kanban" : "board");
    window.setTimeout(() => {
      document.getElementById(`milestone-${milestoneId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  if (isLoading) return <FullPageSpinner />;
  if (isError || !project)
    return <ErrorState message="Could not load this project." onRetry={() => refetch()} />;

  const isSupport = project.project_type === "maintenance_support";

  if (isClient) return <ClientProjectWorkspace project={project} />;

  if (isSupport) {
    return (
      <>
        <MaintenanceSupportDashboard
          project={project}
          onEditProject={() => setEditOpen(true)}
          onDeleteProject={() => setDeleteOpen(true)}
        />
        <ProjectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          project={project}
          availableProjects={availableProjects ?? []}
          isPending={update.isPending}
          onSubmit={(payload) => update.mutateAsync({ id, payload })}
        />
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Maintenance & Support workspace"
          description={`Delete "${project.name}" and all of its service records?`}
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(id, { onSuccess: () => navigate("/projects") })}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" /> Projects
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <BriefcaseBusiness className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold text-fg">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            <RiskBadge risk={project.risk_level} />
            <ProjectGitHubButton
              project={project}
              isAdmin={isAdmin}
              onSave={(payload) => update.mutateAsync({ id, payload })}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="default">Actual Project</Badge>
            <Badge variant={project.project_manager_name ? "success" : "warning"}>
              <UserRoundCog className="h-3.5 w-3.5" />
              PM: {project.project_manager_name ?? "Not assigned"}
            </Badge>
            {project.support_workspace_id && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => navigate(`/projects/${project.support_workspace_id}`)}
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                {project.support_workspace_name ?? "Open Maintenance & Support"}
              </Button>
            )}
          </div>
          {project.description && <p className="mt-1 text-sm text-fg-muted">{project.description}</p>}
          <p className="mt-1 text-xs text-fg-subtle">
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {canEditProjectContent && <TabsTrigger value="kanban">Kanban</TabsTrigger>}
            {!canEditProjectContent && <TabsTrigger value="board">Milestones &amp; Tasks</TabsTrigger>}
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab projectId={id} />
          </TabsContent>
          {canEditProjectContent && (
            <TabsContent value="kanban">
              <KanbanBoard project={project} />
            </TabsContent>
          )}
          {!canEditProjectContent && (
            <TabsContent value="board">
              <MilestonesTasksBoard project={project} />
            </TabsContent>
          )}
          <TabsContent value="gantt">
            <GanttTab projectId={id} onOpenMilestone={openMilestoneFromGantt} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentRepository projectId={id} workspace="project" />
          </TabsContent>
          <TabsContent value="meetings">
            <MeetingsPanel projectId={id} />
          </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        availableProjects={availableProjects ?? []}
        isPending={update.isPending}
        onSubmit={(payload) => update.mutateAsync({ id, payload })}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project"
        description={`Delete "${project.name}" and everything in it?`}
        isPending={remove.isPending}
        onConfirm={() => remove.mutate(id, { onSuccess: () => navigate("/projects") })}
      />
    </div>
  );
}

function resolveProjectTab(requested: string | null, canEditProjectContent: boolean): string {
  const normalized = requested === "kanban" && !canEditProjectContent ? "board" : requested;
  const allowed = canEditProjectContent
    ? ["overview", "kanban", "gantt", "documents", "meetings"]
    : ["overview", "board", "gantt", "documents", "meetings"];
  return normalized && allowed.includes(normalized) ? normalized : "overview";
}

function OverviewTab({ projectId }: { projectId: number }) {
  const summary = useSummary(projectId);
  const status = useStatusBreakdown(projectId);
  const milestones = useMilestones(projectId);
  const delayed = useDelayedTasks(projectId);

  return (
    <div className="flex flex-col gap-4">
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Progress" value={`${summary.data.progress_pct}%`} icon={Percent} />
          <KpiCard
            label="Completed"
            value={`${summary.data.done_tasks}/${summary.data.total_tasks}`}
            icon={CheckCircle2}
            accent="success"
          />
          <KpiCard label="Total tasks" value={summary.data.total_tasks} icon={ListChecks} />
          <KpiCard
            label="Delayed"
            value={summary.data.delayed_tasks}
            icon={AlertTriangle}
            accent={summary.data.delayed_tasks > 0 ? "danger" : "default"}
          />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {status.data && <StatusBreakdownChart data={status.data} />}
        {milestones.isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          milestones.data && <MilestonesTable milestones={milestones.data} />
        )}
      </div>
      {delayed.data && <DelaysTable data={delayed.data} showProject={false} />}
    </div>
  );
}

function GanttTab({
  projectId,
  onOpenMilestone,
}: {
  projectId: number;
  onOpenMilestone: (milestoneId: number) => void;
}) {
  const { data, isLoading, isError, refetch } = useGantt(projectId);
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (isError) return <ErrorState message="Could not load the timeline." onRetry={() => refetch()} />;
  return <GanttChart tasks={data ?? []} onOpenMilestone={onOpenMilestone} />;
}
