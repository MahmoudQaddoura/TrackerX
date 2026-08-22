import { ArrowLeft, CalendarRange, CheckCircle2, FileCheck2, ListChecks, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { GanttChart } from "@/components/gantt/GanttChart";
import { MeetingsPanel } from "@/components/meetings/MeetingsPanel";
import { MilestonesTasksBoard } from "@/components/project/MilestonesTasksBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGantt } from "@/hooks/useAnalytics";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types";

export function ClientProjectWorkspace({ project }: { project: Project }) {
  const navigate = useNavigate();
  const gantt = useGantt(project.id);
  return <div className="flex flex-col gap-5">
    <div><Button variant="ghost" size="sm" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4" /> My projects</Button></div>
    <Card className="overflow-hidden border-accent/20"><div className="border-l-4 border-accent px-6 py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-bold text-fg">{project.name}</h1><Badge variant={project.status === "active" ? "success" : "default"}>{project.status.replace("_", " ")}</Badge></div><p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">{project.description || "Client-facing project delivery details."}</p><p className="mt-2 flex items-center gap-2 text-xs text-fg-subtle"><CalendarRange className="h-3.5 w-3.5" /> {formatDate(project.start_date)} — {formatDate(project.end_date)}</p></div><Button variant="outline" onClick={() => navigate("/dashboard")}><FileCheck2 className="h-4 w-4" /> Shared reports</Button></div></div></Card>
    <div className="grid gap-3 sm:grid-cols-3"><KpiCard label="Project progress" value={`${project.progress_pct}%`} icon={Percent} /><KpiCard label="Completed tasks" value={`${project.done_tasks}/${project.total_tasks}`} icon={CheckCircle2} accent="success" /><KpiCard label="Milestones" value={project.milestone_count} icon={ListChecks} /></div>
    <Tabs defaultValue="overview"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="tasks">Milestones & tasks</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="meetings">Client meetings</TabsTrigger></TabsList>
      <TabsContent value="overview"><Card><CardContent className="grid gap-4 pt-5 md:grid-cols-3"><Info label="Project status" value={project.status.replace("_", " ")} /><Info label="Delivery period" value={`${formatDate(project.start_date)} — ${formatDate(project.end_date)}`} /><Info label="Current progress" value={`${project.progress_pct}% complete`} /><div className="md:col-span-3 rounded-lg border border-accent/20 bg-accent-soft/50 p-4"><p className="font-semibold text-fg">Client visibility</p><p className="mt-1 text-sm text-fg-muted">This workspace shows project tasks and dates without internal employee assignments. Final reports are delivered separately through your secure dashboard after administrator approval.</p></div></CardContent></Card></TabsContent>
      <TabsContent value="tasks"><MilestonesTasksBoard project={project} hideTeamDetails /></TabsContent>
      <TabsContent value="timeline">{gantt.isLoading ? <Skeleton className="h-80" /> : gantt.isError ? <ErrorState message="Could not load the project timeline." onRetry={() => gantt.refetch()} /> : <GanttChart tasks={gantt.data ?? []} onOpenMilestone={() => undefined} />}</TabsContent>
      <TabsContent value="meetings"><MeetingsPanel projectId={project.id} clientOnly /></TabsContent>
    </Tabs>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-raised/70 p-4"><p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p><p className="mt-1 font-semibold capitalize text-fg">{value}</p></div>;
}
