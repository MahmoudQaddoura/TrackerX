import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  FileArchive,
  FolderKanban,
  LayoutDashboard,
  MessagesSquare,
  Radio,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { DelaysTable } from "@/components/dashboard/DelaysTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectProgressChart } from "@/components/dashboard/ProjectProgressChart";
import { StatusBreakdownChart } from "@/components/dashboard/StatusBreakdownChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  useDelayedTasks,
  useProjectTimelines,
  useStatusBreakdown,
  useSummary,
} from "@/hooks/useAnalytics";
import { useAttendance } from "@/hooks/useAttendance";
import { useProjects } from "@/hooks/useProjects";
import { timeGreeting } from "@/lib/greeting";
import type { AttendanceStatus, Project } from "@/types";
import { ClientDashboardPage } from "@/pages/ClientDashboardPage";

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  not_recorded: "Not recorded",
  present: "Present",
  remote: "Remote",
  leave: "Leave",
  sick_leave: "Sick leave",
  absent: "Absent",
};

export function DashboardPage() {
  const { isClient } = useAuth();
  return isClient ? <ClientDashboardPage /> : <TeamDashboardPage />;
}

function TeamDashboardPage() {
  const navigate = useNavigate();
  const { user, canViewManagement, canManage } = useAuth();
  const summary = useSummary();
  const status = useStatusBreakdown();
  const timelines = useProjectTimelines();
  const delayed = useDelayedTasks();
  const projects = useProjects();
  const today = localDate();
  const attendance = useAttendance(today);
  const delayedCount = delayed.data?.length ?? summary.data?.delayed_tasks ?? 0;
  const displayName = user?.full_name ?? "Team member";
  const singleAssignedProject = projects.data?.length === 1 ? projects.data[0] : null;
  const assignedToolPath = (tab: string) =>
    singleAssignedProject ? `/projects/${singleAssignedProject.id}?tab=${tab}` : "/projects";
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${today}T12:00:00`));

  const attendanceRows = attendance.data ?? [];
  const attendanceRecorded = attendanceRows.filter((row) => row.status !== "not_recorded").length;
  const onDuty = attendanceRows.filter((row) => row.status === "present" || row.status === "remote").length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent via-accent to-accent-hover px-6 py-6 text-white shadow-lg">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <Badge className="border border-white/20 bg-white/10 text-white">
              <Radio className="h-3 w-3 animate-pulse" />
              {canViewManagement ? "Live portfolio" : "My live workspace"}
            </Badge>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
              {timeGreeting()}, {displayName}
            </h1>
            <p className="mt-1 text-sm text-white/75">
              {canViewManagement
                ? "Your project delivery, operations, people, documents, and schedule alerts in one place."
                : "Everything related to the projects you are assigned to, from tasks and Gantt schedules to documents and meetings."}
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Today</p>
            <p className="mt-1 font-semibold text-white">{todayLabel}</p>
            <p className="mt-1 text-xs text-white/65">Updates automatically while this page is open</p>
          </div>
        </div>
      </Card>

      {delayed.isLoading ? (
        <Skeleton className="h-20" />
      ) : delayedCount > 0 ? (
        <Card className="overflow-hidden border-danger/35 bg-danger/5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-danger px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-danger/15 text-danger">
                <span className="absolute inset-0 animate-ping rounded-full bg-danger/10" />
                <AlertTriangle className="relative h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-danger">Delivery attention required</p>
                <p className="text-sm text-fg-muted">
                  {delayedCount} {delayedCount === 1 ? "task is" : "tasks are"} delayed or past due.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => document.getElementById("delay-alerts")?.scrollIntoView({ behavior: "smooth" })}
            >
              Review alerts <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-success/25 bg-success/5">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-fg">No active delivery alerts</p>
              <p className="text-xs text-fg-muted">No manually delayed or automatically past-due tasks were detected.</p>
            </div>
          </div>
        </Card>
      )}

      {summary.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
        </div>
      ) : summary.isError ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : summary.data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={canViewManagement ? "Active projects" : "Assigned projects"}
            value={`${summary.data.active_projects}/${summary.data.total_projects}`}
            description={canViewManagement ? "Open the project portfolio" : "Projects linked through your assignments"}
            icon={FolderKanban}
            to="/projects"
          />
          <KpiCard
            label={canViewManagement ? "Portfolio progress" : "Project progress"}
            value={`${summary.data.progress_pct}%`}
            description={canViewManagement ? "Across every tracked task" : "Across your assigned project workspaces"}
            icon={TrendingUp}
            accent={summary.data.progress_pct >= 75 ? "success" : "default"}
            to="/projects"
          />
          <KpiCard
            label={canViewManagement ? "Completed tasks" : "Completed project tasks"}
            value={`${summary.data.done_tasks}/${summary.data.total_tasks}`}
            description={`${summary.data.total_tasks - summary.data.done_tasks} tasks remaining`}
            icon={CheckCircle2}
            accent="success"
            to="/projects"
          />
          <KpiCard
            label="Delay alerts"
            value={delayedCount}
            description={delayedCount > 0 ? "Requires attention" : "Your projects are on track"}
            icon={AlertTriangle}
            accent={delayedCount > 0 ? "danger" : "success"}
            to="/dashboard#delay-alerts"
          />
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">
              {canViewManagement ? "Management workspace" : "My project tools"}
            </h2>
            <p className="text-xs text-fg-muted">
              {canViewManagement ? "Go directly to the tool you need" : "Only projects connected to your task assignments are available"}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canViewManagement ? (
            <>
              <WorkspaceLink to="/projects" icon={LayoutDashboard} title="Kanban & Gantt" description="Tasks, milestones, delivery and operations" />
              <WorkspaceLink to="/projects" icon={FileArchive} title="Document control" description="Project files, bulk uploads and milestone tags" />
              <WorkspaceLink to="/attendance" icon={CalendarCheck2} title="Attendance" description="Daily sheet, check-in, status and notes" />
              <WorkspaceLink to="/employees" icon={Users} title="Employees & access" description="Profiles, credentials and permissions" />
            </>
          ) : (
            <>
              <WorkspaceLink to="/projects" icon={FolderKanban} title="Assigned projects" description="Open only the projects connected to your tasks" />
              <WorkspaceLink to={assignedToolPath("board")} icon={ClipboardList} title="Milestones & tasks" description="Review the Kanban work and assignments" />
              <WorkspaceLink to={assignedToolPath("gantt")} icon={CalendarRange} title="Gantt schedules" description="See milestones, dates, and delivery sequence" />
              <WorkspaceLink to={assignedToolPath("documents")} icon={FileArchive} title="Documents" description="Access project and operations files" />
              <WorkspaceLink to={assignedToolPath("meetings")} icon={MessagesSquare} title="Meetings" description="Review project discussions and outcomes" />
              <WorkspaceLink to="/attendance" icon={CalendarCheck2} title="My attendance" description="Review your daily status and working hours" />
            </>
          )}
        </div>
      </section>

      {!canViewManagement && (
        projects.isLoading ? (
          <Skeleton className="h-64" />
        ) : projects.isError ? (
          <ErrorState message="Could not load your assigned projects." onRetry={() => projects.refetch()} />
        ) : (
          <AssignedProjectsWorkspace projects={projects.data ?? []} />
        )
      )}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {status.isLoading ? (
          <Skeleton className="h-[340px]" />
        ) : status.isError ? (
          <ErrorState onRetry={() => status.refetch()} />
        ) : status.data && <StatusBreakdownChart data={status.data} />}

        <Card className="h-full overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold text-fg">{canViewManagement ? "Attendance today" : "My attendance today"}</h2>
              <p className="mt-1 text-xs text-fg-muted">
                {canViewManagement ? "People availability and daily recording progress" : "Your recorded availability and working hours"}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/attendance">Open sheet <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          {attendance.isLoading ? (
            <div className="p-5"><Skeleton className="h-44" /></div>
          ) : attendance.isError ? (
            <div className="p-5"><ErrorState message="Could not load today's attendance." onRetry={() => attendance.refetch()} /></div>
          ) : (
            <div className="p-5">
              {canViewManagement ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <MiniMetric label="Employees" value={attendanceRows.length} />
                    <MiniMetric label="Recorded" value={`${attendanceRecorded}/${attendanceRows.length}`} />
                    <MiniMetric label="On duty" value={onDuty} accent />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {attendanceRows.slice(0, 6).map((row) => (
                      <div key={row.team_member_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
                        <span className="min-w-0 truncate text-sm font-medium text-fg">{row.employee_name}</span>
                        <Badge variant={row.status === "present" ? "success" : row.status === "absent" ? "danger" : row.status === "not_recorded" ? "outline" : "default"}>
                          {ATTENDANCE_LABEL[row.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {attendanceRows.length > 6 && <p className="mt-3 text-center text-xs text-fg-subtle">+{attendanceRows.length - 6} more employees</p>}
                </>
              ) : attendanceRows[0] ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <MiniMetric label="Status" value={ATTENDANCE_LABEL[attendanceRows[0].status]} accent={onDuty > 0} />
                    <MiniMetric label="Check in" value={attendanceRows[0].check_in ?? "—"} />
                    <MiniMetric label="Check out" value={attendanceRows[0].check_out ?? "—"} />
                  </div>
                  <div className="mt-4 rounded-lg border border-border/70 px-3 py-3 text-sm text-fg-muted">
                    {attendanceRows[0].notes ?? "No attendance note for today."}
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-fg-muted">
                  This login is not linked to an active employee attendance profile.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {timelines.isLoading ? (
        <Skeleton className="h-80" />
      ) : timelines.isError ? (
        <ErrorState onRetry={() => timelines.refetch()} />
      ) : timelines.data && (
        <ProjectProgressChart data={timelines.data} onProjectSelect={(projectId) => navigate(`/projects/${projectId}`)} />
      )}

      {delayed.isLoading ? (
        <Skeleton className="h-48" />
      ) : delayed.isError ? (
        <ErrorState onRetry={() => delayed.refetch()} />
      ) : delayed.data && (
        <DelaysTable
          data={delayed.data}
          onOpenTask={(task) => navigate(`/projects/${task.project_id}?tab=${canManage ? "kanban" : "board"}&milestone=${task.milestone_id}`)}
        />
      )}
    </div>
  );
}

function AssignedProjectsWorkspace({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center">
        <FolderKanban className="mx-auto h-8 w-8 text-fg-subtle" />
        <h2 className="mt-3 font-semibold text-fg">No assigned projects yet</h2>
        <p className="mt-1 text-sm text-fg-muted">A project will appear here as soon as you are assigned to one of its tasks.</p>
      </Card>
    );
  }

  const tools = [
    { tab: "overview", label: "Overview" },
    { tab: "board", label: "Tasks" },
    { tab: "gantt", label: "Gantt" },
    { tab: "documents", label: "Documents" },
    { tab: "meetings", label: "Meetings" },
  ];

  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold text-fg">My assigned project access</h2>
        <p className="text-xs text-fg-muted">Every tool below follows your live task assignments</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div className="min-w-0">
                <Link className="font-semibold text-fg hover:text-accent" to={`/projects/${project.id}`}>
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-fg-muted">
                  {project.done_tasks}/{project.total_tasks} tasks complete · {project.progress_pct}% progress
                </p>
              </div>
              <Badge variant={project.is_delayed ? "danger" : "success"}>
                {project.is_delayed ? "Attention" : "On track"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {tools.map((tool) => (
                <Button key={tool.tab} variant="outline" size="sm" asChild>
                  <Link to={`/projects/${project.id}?tab=${tool.tab}`}>{tool.label}</Link>
                </Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function WorkspaceLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

function MiniMetric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-raised/65 p-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-success" : "text-fg"}`}>{value}</p>
    </div>
  );
}
