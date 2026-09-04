import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileCheck2,
  Download,
  Inbox,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useClientPortal, useMarkClientReportRead } from "@/hooks/useClients";
import { exportForwardedReportPdf } from "@/api/clients";
import { timeGreeting } from "@/lib/greeting";
import { formatDate } from "@/lib/utils";
import type { ClientReportShare } from "@/types";

const REPORT_LABELS: Record<string, string> = {
  health_check: "Health check",
  patch_update: "Patch update",
  penetration_testing: "Penetration testing",
  updates: "System updates",
  performance: "Performance",
  kpi: "KPI",
};

const FIELD_LABELS: Record<string, string> = {
  period_start: "Period start",
  period_end: "Period end",
  due_date: "Due date",
  executive_summary: "Executive summary",
  findings: "Findings",
  work_completed: "Work completed",
  recommendations: "Recommendations",
  next_action_date: "Next action date",
  detection_source: "Detected by",
  reported_by_name: "Reporter / detection source",
  affected_service: "Affected service",
  client_report: "Client report",
  reason: "Reason",
  description: "Description",
  reported_at: "Reported at",
  severity: "Severity",
  recommendation: "Recommendation",
  containment_actions: "Containment actions",
  investigation: "Investigation",
  root_cause: "Confirmed root cause",
  response_at: "Response time",
  response_description: "Response description",
  recovery_validation: "Recovery validation",
  resolution_notes: "Resolution notes",
  lessons_learned: "Lessons learned and prevention",
};

export function ClientDashboardPage() {
  const { user } = useAuth();
  const portal = useClientPortal();
  const markRead = useMarkClientReportRead();
  const [selectedReport, setSelectedReport] = useState<ClientReportShare | null>(null);

  if (portal.isLoading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;
  if (portal.isError || !portal.data) return <ErrorState message="Could not load your client workspace." onRetry={() => portal.refetch()} />;

  const { profile, reports } = portal.data;
  const unread = reports.filter((report) => !report.read_at).length;
  const activeProjects = profile.projects.filter((project) => project.status === "active").length;
  const completedTasks = profile.projects.reduce((sum, project) => sum + project.done_tasks, 0);
  const totalTasks = profile.projects.reduce((sum, project) => sum + project.total_tasks, 0);

  function openReport(report: ClientReportShare) {
    setSelectedReport(report);
    if (!report.read_at) markRead.mutate(report.id);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-[#073a5b] via-accent to-[#0f6b86] px-6 py-7 text-white shadow-lg">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <Badge className="border border-white/20 bg-white/10 text-white"><ShieldCheck className="h-3.5 w-3.5" /> Secure client workspace</Badge>
            <h1 className="mt-4 font-display text-3xl font-bold">{timeGreeting()}, {user?.full_name}</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">Track approved project progress, review client-facing milestones, and receive finalized reports from the TrackerX team.</p>
          </div>
          <div className="min-w-64 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Organization</p>
            <p className="mt-1 font-semibold">{profile.organization || "Client account"}</p>
            <p className="mt-2 flex items-center gap-2 text-xs text-white/70"><Mail className="h-3.5 w-3.5" /> {profile.email}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalMetric icon={BriefcaseBusiness} label="Approved projects" value={profile.projects.length} detail={`${activeProjects} active`} />
        <PortalMetric icon={CheckCircle2} label="Delivery progress" value={`${completedTasks}/${totalTasks}`} detail="Client-visible tasks complete" />
        <PortalMetric icon={FileCheck2} label="Shared reports" value={reports.length} detail="Finalized and approved" />
        <PortalMetric icon={Inbox} label="Unread reports" value={unread} detail={unread ? "Ready for your review" : "You are up to date"} attention={unread > 0} />
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-fg">My projects</h2><p className="text-xs text-fg-muted">Only projects approved for this client account are shown.</p></div><Button variant="outline" size="sm" asChild><Link to="/projects">View all <ArrowRight className="h-4 w-4" /></Link></Button></div>
        {profile.projects.length ? <div className="grid gap-4 lg:grid-cols-2">{profile.projects.map((project) => <Card key={project.id} className="overflow-hidden"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-fg">{project.name}</h3><p className="mt-1 line-clamp-2 text-sm text-fg-muted">{project.description || "Project delivery workspace"}</p></div><Badge variant={project.status === "active" ? "success" : "default"}>{project.status.replace("_", " ")}</Badge></div><div className="mt-5 flex items-center gap-3"><Progress value={project.progress_pct} className="flex-1" /><span className="text-sm font-semibold text-fg">{project.progress_pct}%</span></div><div className="mt-2 flex justify-between text-xs text-fg-subtle"><span>{project.done_tasks}/{project.total_tasks} tasks complete</span><span>{formatDate(project.start_date)} — {formatDate(project.end_date)}</span></div><Button className="mt-4 w-full" variant="outline" asChild><Link to={`/projects/${project.id}`}>Open project details <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>)}</div> : <EmptyState icon={BriefcaseBusiness} title="No approved projects yet" description="Your project access will appear here after the TrackerX administrator assigns it." />}
      </section>

      <section>
        <div className="mb-3"><h2 className="font-display text-lg font-semibold text-fg">Reports from TrackerX</h2><p className="text-xs text-fg-muted">Only finalized reports explicitly forwarded by an administrator appear here.</p></div>
        {reports.length ? <Card className="overflow-hidden"><div className="divide-y divide-border">{reports.map((report) => <button key={report.id} type="button" onClick={() => openReport(report)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-raised"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${report.read_at ? "bg-raised text-fg-muted" : "bg-accent-soft text-accent"}`}><FileCheck2 className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold text-fg">{report.title}</span>{!report.read_at && <Badge variant="warning">New</Badge>}<Badge variant="outline">{report.report_type === "incident" ? "Incident" : REPORT_LABELS[report.category ?? ""] || "Service report"}</Badge></span><span className="mt-1 block text-xs text-fg-muted">{report.project_name} · Shared {formatDate(report.shared_at)}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" /></button>)}</div></Card> : <EmptyState icon={Inbox} title="No reports shared yet" description="Finalized reports will appear here after an administrator forwards them to your account." />}
      </section>

      <ReportDialog report={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
}

function PortalMetric({ icon: Icon, label, value, detail, attention = false }: { icon: typeof Building2; label: string; value: string | number; detail: string; attention?: boolean }) {
  return <Card><CardContent className="pt-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-fg-muted">{label}</p><p className={`mt-1 text-2xl font-bold ${attention ? "text-warning" : "text-fg"}`}>{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${attention ? "bg-warning/10 text-warning" : "bg-accent-soft text-accent"}`}><Icon className="h-4.5 w-4.5" /></span></div><p className="mt-2 text-xs text-fg-subtle">{detail}</p></CardContent></Card>;
}

function ReportDialog({ report, onClose }: { report: ClientReportShare | null; onClose: () => void }) {
  const visibleFields = report ? Object.entries(report.report).filter(([key, value]) => value != null && value !== "" && !["title", "status", "category", "service_area_name", "updated_at"].includes(key)) : [];
  async function download() {
    if (!report) return;
    const blob = await exportForwardedReportPdf(report.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.report_type === "incident" ? "incident" : "service"}-report-${String(report.report_id).padStart(4, "0")}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{report && <><DialogHeader><div className="flex items-center justify-between gap-4 pr-8"><DialogTitle>{report.title}</DialogTitle><Button size="sm" onClick={download}><Download className="h-4 w-4" /> Download PDF</Button></div></DialogHeader><div className="flex flex-wrap items-center gap-2"><Badge variant={report.report_type === "incident" ? "warning" : "default"}>{report.report_type === "incident" ? "Incident report" : String(report.report.service_area_name || REPORT_LABELS[report.category ?? ""] || "Service report")}</Badge><Badge variant="outline">{report.status.split("_").join(" ")}</Badge><span className="text-xs text-fg-muted">{report.project_name}</span></div>{report.message && <div className="rounded-lg border border-accent/20 bg-accent-soft/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Message from TrackerX</p><p className="mt-1 whitespace-pre-wrap text-sm text-fg">{report.message}</p></div>}<div className="space-y-3">{visibleFields.map(([key, value]) => <div key={key} className="rounded-lg border border-border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{FIELD_LABELS[key] || key.split("_").join(" ")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">{String(value)}</p></div>)}</div><div className="flex items-center justify-between border-t border-border pt-4 text-xs text-fg-muted"><span>Forwarded by {report.shared_by_name || "TrackerX administrator"}</span><span>{formatDate(report.shared_at)}</span></div></>}</DialogContent></Dialog>;
}
