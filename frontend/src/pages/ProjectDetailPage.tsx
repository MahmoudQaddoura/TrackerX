/**
 * pages/ProjectDetailPage.tsx
 * A single project, tabs scoped per role:
 *   admin/pm  : Overview, Kanban (their work surface), Gantt, Documents, Meetings
 *   developer : Kanban only (no tab bar — nothing else to see)
 *   client    : Overview, Milestones & Tasks (read-only), Gantt, Documents, Meetings
 * Admin/pm get edit/delete on the project header; only admin can delete.
 */
import { AlertTriangle, ArrowLeft, CheckCircle2, ListChecks, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
import { MilestonesTasksBoard } from "@/components/project/MilestonesTasksBoard";
import { Button } from "@/components/ui/button";
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
import { useProject, useProjectMutations } from "@/hooks/useProjects";
import { formatDate } from "@/lib/utils";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const { isAdmin, canManage, isDeveloper } = useAuth();
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { update, remove } = useProjectMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <FullPageSpinner />;
  if (isError || !project)
    return <ErrorState message="Could not load this project." onRetry={() => refetch()} />;

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
            <h1 className="font-display text-2xl font-bold text-fg">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            <RiskBadge risk={project.risk_level} />
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

      {isDeveloper ? (
        // Developers only ever see the board — no tab bar needed for one tab.
        <KanbanBoard project={project} />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {canManage && <TabsTrigger value="kanban">Kanban</TabsTrigger>}
            {!canManage && <TabsTrigger value="board">Milestones &amp; Tasks</TabsTrigger>}
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab projectId={id} />
          </TabsContent>
          {canManage && (
            <TabsContent value="kanban">
              <KanbanBoard project={project} />
            </TabsContent>
          )}
          {!canManage && (
            <TabsContent value="board">
              <MilestonesTasksBoard project={project} />
            </TabsContent>
          )}
          <TabsContent value="gantt">
            <GanttTab projectId={id} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentRepository projectId={id} />
          </TabsContent>
          <TabsContent value="meetings">
            <MeetingsPanel projectId={id} />
          </TabsContent>
        </Tabs>
      )}

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
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

function OverviewTab({ projectId }: { projectId: number }) {
  const summary = useSummary(projectId);
  const status = useStatusBreakdown(projectId);
  const milestones = useMilestones(projectId);
  const delayed = useDelayedTasks(projectId);

  return (
    <div className="flex flex-col gap-4">
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Progress" value={`${summary.data.progress_pct}%`} icon={ListChecks} />
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

function GanttTab({ projectId }: { projectId: number }) {
  const { data, isLoading, isError, refetch } = useGantt(projectId);
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (isError) return <ErrorState message="Could not load the timeline." onRetry={() => refetch()} />;
  return <GanttChart tasks={data ?? []} />;
}
