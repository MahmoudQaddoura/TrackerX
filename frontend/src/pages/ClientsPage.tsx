import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  FileCheck2,
  Mail,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useClientMutations, useClientReportAdmin, useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { getApiErrorMessage } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import type { ClientProfile, Project } from "@/types";

const EMPTY_FORM = {
  fullName: "",
  email: "",
  organization: "",
  jobTitle: "",
  phone: "",
  notes: "",
  password: "",
};

export function ClientsPage() {
  const clients = useClients();
  const projects = useProjects();
  const { create } = useClientMutations();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const availableProjects = (projects.data ?? []).filter(
    (project) => project.project_type === "actual_project",
  );
  const rows = clients.data ?? [];
  const normalized = search.trim().toLowerCase();
  const filtered = rows.filter((client) =>
    !normalized ||
    [client.full_name, client.email, client.organization ?? ""]
      .some((value) => value.toLowerCase().includes(normalized)) ||
    client.projects.some((project) => project.name.toLowerCase().includes(normalized)),
  );
  const selected = rows.find((client) => client.id === selectedId) ?? null;
  const linkedProjects = new Set(rows.flatMap((client) => client.projects.map((project) => project.id))).size;
  const sharedReports = rows.reduce((sum, client) => sum + client.shared_report_count, 0);

  function toggleProject(projectId: number) {
    setProjectIds((current) => current.includes(projectId)
      ? current.filter((id) => id !== projectId)
      : [...current, projectId]);
  }

  async function handleCreate() {
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (form.password.length < 12) {
      setError("The temporary password must contain at least 12 characters.");
      return;
    }
    setError(null);
    try {
      const created = await create.mutateAsync({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        temporary_password: form.password,
        organization: form.organization.trim() || null,
        job_title: form.jobTitle.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        project_ids: projectIds,
      });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setProjectIds([]);
      setSelectedId(created.id);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not create the client account."));
    }
  }

  if (clients.isLoading) return <div className="flex min-h-[45vh] items-center justify-center"><Spinner /></div>;
  if (clients.isError) return <ErrorState message="Could not load clients." onRetry={() => clients.refetch()} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold text-fg">Clients</h1>
              <p className="text-sm text-fg-muted">Profiles, project visibility, and controlled report delivery.</p>
            </div>
          </div>
        </div>
        <Button onClick={() => { setError(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={UserRound} label="Client accounts" value={rows.length} />
        <SummaryCard icon={BriefcaseBusiness} label="Linked projects" value={linkedProjects} />
        <SummaryCard icon={FileCheck2} label="Reports forwarded" value={sharedReports} />
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by client, organization, email, or project..."
            />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={rows.length ? "No clients match your search" : "No client accounts yet"}
          description={rows.length ? "Try a different search." : "Create a client profile and connect it to approved projects."}
          action={!rows.length ? <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add client</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} onOpen={() => setSelectedId(client.id)} />
          ))}
        </div>
      )}

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        projects={availableProjects}
        selectedProjectIds={projectIds}
        toggleProject={toggleProject}
        error={error}
        saving={create.isPending}
        onSubmit={handleCreate}
      />
      <ClientProfileDialog
        client={selected}
        projects={availableProjects}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-5">
        <div><p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p><p className="mt-1 text-2xl font-bold text-fg">{value}</p></div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="h-5 w-5" /></span>
      </CardContent>
    </Card>
  );
}

function ClientCard({ client, onOpen }: { client: ClientProfile; onOpen: () => void }) {
  const initials = client.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <button type="button" onClick={onOpen} className="group rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:border-accent/35 group-hover:shadow-md">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h2 className="truncate font-semibold text-fg">{client.full_name}</h2><p className="truncate text-xs text-fg-muted">{client.organization || "Independent client"}</p></div>
                <Badge variant={client.is_enabled ? "success" : "outline"}>{client.is_enabled ? "Active" : "Disabled"}</Badge>
              </div>
              <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-fg-subtle"><Mail className="h-3.5 w-3.5" /> {client.email}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-raised/70 p-3"><p className="text-xs text-fg-subtle">Projects</p><p className="mt-0.5 font-semibold text-fg">{client.projects.length}</p></div>
            <div className="rounded-lg bg-raised/70 p-3"><p className="text-xs text-fg-subtle">Reports</p><p className="mt-0.5 font-semibold text-fg">{client.shared_report_count}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {client.projects.slice(0, 3).map((project) => <Badge key={project.id} variant="default">{project.name}</Badge>)}
            {client.projects.length > 3 && <Badge variant="outline">+{client.projects.length - 3}</Badge>}
            {!client.projects.length && <span className="text-xs text-fg-subtle">No project access assigned</span>}
          </div>
          <div className="mt-4 flex items-center justify-end gap-1 text-xs font-semibold text-accent">Open profile <ArrowRight className="h-3.5 w-3.5" /></div>
        </CardContent>
      </Card>
    </button>
  );
}

type CreateForm = typeof EMPTY_FORM;
function CreateClientDialog({ open, onOpenChange, form, setForm, projects, selectedProjectIds, toggleProject, error, saving, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateForm;
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  projects: Project[];
  selectedProjectIds: number[];
  toggleProject: (projectId: number) => void;
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
}) {
  const field = (key: keyof CreateForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add client account</DialogTitle></DialogHeader>
        <p className="text-sm text-fg-muted">Create a private login and choose exactly which projects this client can access.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.fullName} onChange={field("fullName")} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={field("email")} /></Field>
          <Field label="Organization"><Input value={form.organization} onChange={field("organization")} /></Field>
          <Field label="Job title"><Input value={form.jobTitle} onChange={field("jobTitle")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={field("phone")} /></Field>
          <Field label="Temporary password"><PasswordInput value={form.password} onChange={field("password")} minLength={12} maxLength={128} placeholder="12+ characters; use 3 character types" /></Field>
        </div>
        <Field label="Internal admin notes"><Textarea value={form.notes} onChange={field("notes")} /></Field>
        <ProjectChecklist projects={projects} selected={selectedProjectIds} toggle={toggleProject} />
        <div className="rounded-lg border border-accent/20 bg-accent-soft/60 p-3 text-sm text-fg-muted">
          <ShieldCheck className="mr-2 inline h-4 w-4 text-accent" />
          Client accounts are always read-only and must replace their temporary password at first sign-in.
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={onSubmit} disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Create client</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientProfileDialog({ client, projects, onClose }: { client: ClientProfile | null; projects: Project[]; onClose: () => void }) {
  const { update, assignProjects, forwardReport, revokeReport } = useClientMutations();
  const reports = useClientReportAdmin(client?.id ?? null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [enabled, setEnabled] = useState(true);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [reportKey, setReportKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setForm({ fullName: client.full_name, email: client.email, organization: client.organization ?? "", jobTitle: client.job_title ?? "", phone: client.phone ?? "", notes: client.notes ?? "", password: "" });
    setEnabled(client.is_enabled);
    setProjectIds(client.projects.filter((project) => project.access_source === "direct").map((project) => project.id));
    setReportKey("");
    setMessage("");
    setError(null);
  }, [client]);

  const eligible = reports.shareable.data ?? [];
  const selectedReport = useMemo(() => eligible.find((report) => `${report.report_type}:${report.report_id}` === reportKey), [eligible, reportKey]);

  async function saveProfile() {
    if (!client) return;
    setError(null);
    try {
      await update.mutateAsync({ id: client.id, payload: {
        full_name: form.fullName.trim(), email: form.email.trim(), organization: form.organization.trim() || null,
        job_title: form.jobTitle.trim() || null, phone: form.phone.trim() || null, notes: form.notes.trim() || null,
        is_enabled: enabled, ...(form.password ? { temporary_password: form.password } : {}),
      }});
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
  }

  async function saveProjects() {
    if (!client) return;
    setError(null);
    try { await assignProjects.mutateAsync({ id: client.id, projectIds }); }
    catch (requestError) { setError(getApiErrorMessage(requestError)); }
  }

  async function sendReport() {
    if (!client || !selectedReport) return;
    setError(null);
    try {
      await forwardReport.mutateAsync({ clientId: client.id, reportType: selectedReport.report_type, reportId: selectedReport.report_id, message: message.trim() || null });
      setReportKey(""); setMessage("");
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
  }

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        {client && <>
          <DialogHeader><DialogTitle>Client profile · {client.full_name}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted"><Building2 className="h-4 w-4" /> {client.organization || "Independent client"}<span>·</span><Mail className="h-4 w-4" /> {client.email}</div>
          <Tabs defaultValue="profile">
            <TabsList><TabsTrigger value="profile">Profile & login</TabsTrigger><TabsTrigger value="projects">Project access</TabsTrigger><TabsTrigger value="reports">Report forwarding</TabsTrigger></TabsList>
            <TabsContent value="profile" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
                <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Organization"><Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></Field>
                <Field label="Job title"><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Reset temporary password"><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={12} maxLength={128} placeholder="12+ characters; use 3 character types" /></Field>
              </div>
              <Field label="Internal admin notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-accent" /><span><span className="font-medium text-fg">Login enabled</span><span className="block text-xs text-fg-muted">Disable access without deleting the client profile.</span></span></label>
              <div className="flex justify-end"><Button onClick={saveProfile} disabled={update.isPending}>{update.isPending && <Spinner className="h-4 w-4" />} Save profile</Button></div>
            </TabsContent>
            <TabsContent value="projects" className="space-y-4">
              <div className="rounded-lg border border-accent/20 bg-accent-soft/50 p-3 text-sm text-fg-muted"><ShieldCheck className="mr-2 inline h-4 w-4 text-accent" />Select each main project once. Its linked Maintenance &amp; Support workspace is included automatically, with read-only access to assets, documents, service reports, and incidents.</div>
              <ProjectChecklist projects={projects} selected={projectIds} toggle={(id) => setProjectIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} />
              <div className="flex justify-end"><Button onClick={saveProjects} disabled={assignProjects.isPending}>{assignProjects.isPending && <Spinner className="h-4 w-4" />} Save project access</Button></div>
            </TabsContent>
            <TabsContent value="reports" className="space-y-4">
              <Card className="border-accent/25"><CardContent className="space-y-4 pt-5"><div><h3 className="font-semibold text-fg">Forward a finalized report</h3><p className="text-xs text-fg-muted">Only completed proactive reports and closed incidents from linked projects can be sent.</p></div>
                {reports.shareable.isLoading ? <Spinner /> : eligible.length ? <>
                  <div><Label htmlFor="report-select">Report</Label><select id="report-select" className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg" value={reportKey} onChange={(e) => setReportKey(e.target.value)}><option value="">Select a report...</option>{eligible.map((report) => <option key={`${report.report_type}:${report.report_id}`} value={`${report.report_type}:${report.report_id}`} disabled={report.already_shared}>{report.project_name} · {report.title}{report.already_shared ? " (already forwarded)" : ""}</option>)}</select></div>
                  <div><Label htmlFor="forward-message">Message to client</Label><Textarea id="forward-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional context or action requested from the client" /></div>
                  <div className="flex justify-end"><Button onClick={sendReport} disabled={!selectedReport || selectedReport.already_shared || forwardReport.isPending}><Send className="h-4 w-4" /> Forward report</Button></div>
                </> : <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-fg-muted">No finalized reports are available for this client’s linked projects.</p>}
              </CardContent></Card>
              <div><h3 className="mb-2 font-semibold text-fg">Forwarding history</h3>{reports.shared.isLoading ? <Spinner /> : reports.shared.data?.length ? <div className="space-y-2">{reports.shared.data.map((share) => <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><div className="flex items-center gap-2"><Badge variant={share.report_type === "incident" ? "warning" : "default"}>{share.report_type === "incident" ? "Incident" : "Service report"}</Badge><span className="font-medium text-fg">{share.title}</span></div><p className="mt-1 text-xs text-fg-muted">{share.project_name} · Forwarded {formatDate(share.shared_at)} · {share.read_at ? `Read ${formatDate(share.read_at)}` : "Not read"}</p></div><Button variant="ghost" size="icon" aria-label="Revoke report access" onClick={() => revokeReport.mutate(share.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <p className="text-sm text-fg-muted">No reports have been forwarded yet.</p>}</div>
            </TabsContent>
          </Tabs>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </>}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ProjectChecklist({ projects, selected, toggle }: { projects: Project[]; selected: number[]; toggle: (projectId: number) => void }) {
  return (
    <div><Label>Project access</Label><div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">{projects.length ? projects.map((project) => <label key={project.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2.5 hover:bg-raised"><input type="checkbox" checked={selected.includes(project.id)} onChange={() => toggle(project.id)} className="mt-0.5 h-4 w-4 accent-accent" /><span><span className="block text-sm font-medium text-fg">{project.name}</span><span className="block text-xs text-fg-muted">{project.status.replace("_", " ")} · {project.progress_pct}% complete</span></span></label>) : <p className="p-3 text-sm text-fg-muted">No actual projects are available.</p>}</div></div>
  );
}
