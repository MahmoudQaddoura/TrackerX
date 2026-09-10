/**
 * pages/EmployeeListPage.tsx
 * Employee directory — admin & pm only.
 *
 * Two sections:
 *   1. Active Employees   — card grid (always visible)
 *   2. Deactivated        — collapsible section (hidden when empty)
 *
 * Admin: full CRUD + delegate tasks on deactivated members.
 * PM: read-only list with profile drill-down.
 *
 * Special "Owner" badge (amber) on team_members whose role is "Owner".
 */
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderPlus,
  KeyRound,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCircle,
  UserCheck,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  assignMemberProjects,
  createMember,
  delegateMemberTasks,
  deleteMember,
  provisionMemberCredentials,
  updateMember,
  type TeamMemberPayload,
} from "@/api/team";
import { updateProjectManager } from "@/api/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import { useProjects } from "@/hooks/useProjects";
import { getApiErrorMessage } from "@/lib/apiClient";
import { timeGreeting } from "@/lib/greeting";
import { useQueryClient } from "@tanstack/react-query";
import type { EmployeeAccountRole, EmploymentType, Project, TeamMember } from "@/types";

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contractor", label: "Contractor" },
  { value: "intern", label: "Intern" },
];

function employmentLabel(value: EmploymentType) {
  return EMPLOYMENT_OPTIONS.find((option) => option.value === value)?.label ?? "Full-time";
}

function accountRoleLabel(role: EmployeeAccountRole | null) {
  if (role === "admin") return "Administrator";
  if (role === "pm") return "Project manager";
  if (role === "developer") return "Employee";
  return "No login";
}

export function EmployeeListPage() {
  const { isAdmin, isPrimaryAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { data: members, isLoading, isError, refetch } = useTeam();
  const projectsQuery = useProjects();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState<"all" | EmploymentType>("all");
  const [accessFilter, setAccessFilter] = useState<"all" | "manager" | "employee" | "no_login">("all");

  // Credential and access state (admin only)
  const [credentialTarget, setCredentialTarget] = useState<TeamMember | null>(null);
  const [credentialEmail, setCredentialEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [accountRole, setAccountRole] = useState<EmployeeAccountRole>("developer");
  const [accessLevel, setAccessLevel] = useState<"read" | "write">("read");
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  // Direct project assignments (admin only)
  const [projectTarget, setProjectTarget] = useState<TeamMember | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [managerSavingProjectId, setManagerSavingProjectId] = useState<number | null>(null);

  // Delegate state
  const [delegateTarget, setDelegateTarget] = useState<TeamMember | null>(null);
  const [toMemberId, setToMemberId] = useState<number | null>(null);
  const [delegating, setDelegating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [nameArabic, setNameArabic] = useState("");
  const [role, setRole] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");
  const [weeklyHours, setWeeklyHours] = useState("40");

  const rows = members ?? [];
  const allActiveMembers = rows.filter((m) => m.is_active);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (member: TeamMember) => {
    const searchMatches =
      !normalizedSearch ||
      member.employee_number.includes(normalizedSearch) ||
      member.name.toLowerCase().includes(normalizedSearch) ||
      member.role?.toLowerCase().includes(normalizedSearch) ||
      member.projects.some((project) => project.name.toLowerCase().includes(normalizedSearch));
    const employmentMatches = employmentFilter === "all" || member.employment_type === employmentFilter;
    const accessMatches = accessFilter === "all" ||
      (accessFilter === "manager" && member.account_role === "pm") ||
      (accessFilter === "employee" && member.has_login && member.account_role === "developer") ||
      (accessFilter === "no_login" && !member.has_login);
    return searchMatches && employmentMatches && accessMatches;
  };
  const activeMembers = allActiveMembers.filter(matchesSearch);
  const deactivatedMembers = rows.filter((m) => !m.is_active && matchesSearch(m));
  const assignedProjectCount = new Set(rows.flatMap((member) => member.projects.map((project) => project.id))).size;
  const linkedLogins = rows.filter((member) => member.has_login && member.login_enabled).length;
  const openTasks = rows.reduce((total, member) => total + member.total_tasks - member.done_tasks, 0);
  const projectManagers = rows.filter((member) => member.account_role === "pm" && member.login_enabled).length;
  const canReceiveLeadership = Boolean(
    projectTarget &&
    (projectTarget.account_role === "admin" ||
      (projectTarget.account_role === "pm" && projectTarget.access_level === "write")) &&
    projectTarget.login_enabled &&
    projectTarget.is_active,
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setNameArabic("");
    setRole("");
    setRoleDescription("");
    setEmploymentType("full_time");
    setWeeklyHours("40");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditing(member);
    setName(member.name);
    setNameArabic(member.name_arabic ?? "");
    setRole(member.role ?? "");
    setRoleDescription(member.role_description ?? "");
    setEmploymentType(member.employment_type);
    setWeeklyHours(member.weekly_hours != null ? String(member.weekly_hours) : "");
    setError(null);
    setFormOpen(true);
  }

  function openDelegate(member: TeamMember) {
    setDelegateTarget(member);
    setToMemberId(null);
    setDelegating(false);
  }

  function openCredentials(member: TeamMember) {
    setCredentialTarget(member);
    setCredentialEmail(member.login_email ?? "");
    setTemporaryPassword("");
    setAccountRole(member.account_role ?? "developer");
    setAccessLevel(member.access_level ?? "read");
    setLoginEnabled(member.has_login ? member.login_enabled : true);
    setCredentialError(null);
  }

  function openProjectAssignments(member: TeamMember) {
    setProjectTarget(member);
    setSelectedProjectIds(member.assigned_project_ids);
    setProjectError(null);
    setManagerSavingProjectId(null);
  }

  async function handleAssignProjectManager(project: Project) {
    if (!projectTarget || !isPrimaryAdmin || !canReceiveLeadership) return;
    setManagerSavingProjectId(project.id);
    setProjectError(null);
    try {
      await updateProjectManager(project.id, { project_manager_id: projectTarget.id });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["team"] }),
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["project", project.id] }),
      ]);
    } catch (requestError) {
      setProjectError(getApiErrorMessage(requestError, "Could not assign project leadership."));
    } finally {
      setManagerSavingProjectId(null);
    }
  }

  function toggleProject(projectId: number) {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
    setProjectError(null);
  }

  async function handleProjectAssignments() {
    if (!projectTarget) return;
    setProjectSaving(true);
    setProjectError(null);
    try {
      await assignMemberProjects(projectTarget.id, selectedProjectIds);
      setProjectTarget(null);
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      setProjectError(getApiErrorMessage(error, "Could not update project assignments."));
    } finally {
      setProjectSaving(false);
    }
  }

  async function handleCredentials() {
    if (!credentialTarget) return;
    if (!credentialEmail.trim()) return setCredentialError("Email is required.");
    if (!credentialTarget.has_login && temporaryPassword.length < 12)
      return setCredentialError("A temporary password of at least 12 characters is required.");
    setCredentialSaving(true);
    setCredentialError(null);
    try {
      await provisionMemberCredentials(credentialTarget.id, {
        email: credentialEmail.trim(),
        temporary_password: temporaryPassword || null,
        account_role: isPrimaryAdmin ? accountRole : undefined,
        access_level: accessLevel,
        is_enabled: loginEnabled,
      });
      setCredentialTarget(null);
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      setCredentialError(getApiErrorMessage(error));
    } finally {
      setCredentialSaving(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const hours = weeklyHours.trim() ? Number(weeklyHours) : null;
      if (hours != null && (!Number.isFinite(hours) || hours < 1 || hours > 80)) {
        setError("Weekly hours must be between 1 and 80.");
        setSaving(false);
        return;
      }
      const payload: TeamMemberPayload = {
        name: name.trim(),
        name_arabic: nameArabic.trim() || null,
        role: role.trim() || null,
        role_description: roleDescription.trim() || null,
        employment_type: employmentType,
        weekly_hours: hours,
      };
      if (editing) {
        await updateMember(editing.id, payload);
      } else {
        await createMember(payload);
      }
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch {
      setError("Failed to save employee.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: TeamMember) {
    if (!confirm(`Deactivate ${member.name}? Tasks stay attributed.`)) return;
    try {
      await deleteMember(member.id);
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch {
      // ignore
    }
  }

  async function handleDelegate() {
    if (!delegateTarget || toMemberId == null) return;
    setDelegating(true);
    try {
      await delegateMemberTasks(delegateTarget.id, { to_member_id: toMemberId });
      setDelegateTarget(null);
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch {
      // ignore
    } finally {
      setDelegating(false);
    }
  }

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Could not load employees." onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-accent/20 bg-surface shadow-card">
        <div className="relative overflow-hidden bg-accent px-5 py-5 text-white sm:px-6">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[38px] border-white/5" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12"><Users className="h-5 w-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight">Workforce control center</h1>
                  <Badge className="border border-white/20 bg-white/10 text-white">{isPrimaryAdmin ? "Owner controls" : isAdmin ? "Admin controls" : "Read only"}</Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-white/75">
                  {timeGreeting()}, {user?.full_name ?? "Manager"}. Manage employment, job roles, access, project scope, and workload from one structured roster.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="subtle" className="border-white/15 bg-white/10 text-white hover:bg-white/20" asChild>
                <Link to="/attendance">Attendance <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              {isAdmin && <Button size="sm" className="bg-white text-accent hover:bg-white/90" onClick={openCreate}><Plus className="h-4 w-4" /> Add employee</Button>}
            </div>
          </div>
        </div>
        <div className="grid divide-y divide-border bg-surface sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <WorkforceMetric icon={UserCheck} label="Active people" value={allActiveMembers.length} detail={`${rows.length - allActiveMembers.length} inactive`} />
          <WorkforceMetric icon={UserRoundCog} label="Project managers" value={projectManagers} detail={isPrimaryAdmin ? "Owner-assigned leadership" : "Active PM accounts"} />
          <WorkforceMetric icon={KeyRound} label="Portal access" value={`${linkedLogins}/${rows.length}`} detail="Enabled employee logins" />
          <WorkforceMetric icon={ListChecks} label="Open workload" value={openTasks} detail={`${assignedProjectCount} projects covered`} />
        </div>
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-fg">Employee roster</h2>
            <p className="text-xs text-fg-muted">Personal profile, employment, system role, project responsibility, and live workload.</p>
          </div>
          <Badge variant="neutral">{activeMembers.length} shown</Badge>
        </div>
        <div className="grid gap-3 border-b border-border bg-raised/35 p-4 lg:grid-cols-[minmax(260px,1fr)_190px_190px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" /><Input className="bg-surface pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search employee, ID, role, or project" /></div>
          <Select value={employmentFilter} onChange={(event) => setEmploymentFilter(event.target.value as "all" | EmploymentType)}>
            <option value="all">All employment types</option>
            {EMPLOYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as typeof accessFilter)}>
            <option value="all">All account roles</option>
            <option value="manager">Project managers</option>
            <option value="employee">Employees</option>
            <option value="no_login">No portal login</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setEmploymentFilter("all"); setAccessFilter("all"); }}>Clear filters</Button>
        </div>

      {/* ---- Active Employees ---- */}
      {activeMembers.length === 0 ? (
        <div className="p-6"><EmptyState title="No employees match" description="Clear or adjust the roster filters." /></div>
      ) : (
        <div className="divide-y divide-border">
          {activeMembers.map((m) => (
            <EmployeeRow
              key={m.id}
              member={m}
              isDeactivated={false}
              isAdmin={isAdmin}
              isPrimaryAdmin={isPrimaryAdmin}
              onViewProfile={() => navigate(`/employees/${m.id}`)}
              onEdit={() => openEdit(m)}
              onDelete={() => handleDelete(m)}
              onDelegate={() => openDelegate(m)}
              onCredentials={() => openCredentials(m)}
              onProjects={() => openProjectAssignments(m)}
            />
          ))}
        </div>
      )}
      </Card>

      {/* ---- Deactivated Employees ---- */}
      {deactivatedMembers.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-fg-muted hover:text-fg transition-colors"
            onClick={() => setShowDeactivated((v) => !v)}
          >
            {showDeactivated ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Deactivated ({deactivatedMembers.length})
          </button>

          {showDeactivated && (
            <Card className="mt-3 divide-y divide-border overflow-hidden">
              {deactivatedMembers.map((m) => (
                <EmployeeRow
                  key={m.id}
                  member={m}
                  isDeactivated
                  isAdmin={isAdmin}
                  isPrimaryAdmin={isPrimaryAdmin}
                  onViewProfile={() => navigate(`/employees/${m.id}`)}
                  onEdit={() => openEdit(m)}
                  onDelete={() => handleDelete(m)}
                  onDelegate={() => openDelegate(m)}
                  onCredentials={() => openCredentials(m)}
                  onProjects={() => openProjectAssignments(m)}
                />
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Create / Edit form dialog */}
      {formOpen && (
        <Dialog open onOpenChange={() => setFormOpen(false)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit employment profile" : "Add employee"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-name">English name</Label>
                <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-name-ar">Arabic name</Label>
                <Input id="e-name-ar" dir="rtl" lang="ar" value={nameArabic} onChange={(event) => setNameArabic(event.target.value)} placeholder="الاسم باللغة العربية" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-role">Job role</Label>
                <Input
                  id="e-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Backend Engineer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-employment">Employment type</Label>
                <Select id="e-employment" value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType)}>
                  {EMPLOYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="e-role-description">Role responsibilities</Label>
                <Textarea id="e-role-description" rows={3} value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="Responsibilities, expertise, and scope" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-hours">Weekly hours</Label>
                <Input id="e-hours" type="number" min={1} max={80} step={0.5} value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} placeholder="40" />
              </div>
              <div className="rounded-lg border border-accent/15 bg-accent-soft/60 p-3 text-xs leading-relaxed text-fg-muted sm:col-span-2">
                Job role describes the employee’s profession. Employment type and weekly hours describe their working arrangement. Portal permissions and project leadership are managed separately.
              </div>
              {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Spinner />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delegate Tasks Dialog */}
      {delegateTarget && (
        <Dialog open onOpenChange={() => setDelegateTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Delegate tasks from {delegateTarget.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-fg-muted">
                Reassign all pending tasks ({delegateTarget.total_tasks - delegateTarget.done_tasks}{" "}
                open) from <strong>{delegateTarget.name}</strong> to an active employee.
                Completed tasks stay attributed to {delegateTarget.name}.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delegate-to">Delegate to</Label>
                <Select
                  id="delegate-to"
                  value={toMemberId != null ? String(toMemberId) : ""}
                  onChange={(e) => setToMemberId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Choose an employee…</option>
                  {allActiveMembers
                    .filter((m) => m.id !== delegateTarget.id)
                    .map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.employee_number} · {m.name}
                        {m.role ? ` — ${m.role}` : ""} · {m.task_count} tasks
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDelegateTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleDelegate} disabled={toMemberId == null || delegating}>
                {delegating && <Spinner />} Delegate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Direct project assignment dialog */}
      {projectTarget && (
        <Dialog open onOpenChange={() => setProjectTarget(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                Project scope &amp; leadership · {projectTarget.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-accent/15 bg-accent-soft p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Workspace scope</p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">Controls which project workspaces this employee can open. Task-linked access remains while assigned work is open.</p>
                </div>
                <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-success">Project leadership</p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">Only the owner can name a project lead. An Administrator or Project Manager can lead one or several projects.</p>
                </div>
              </div>
              {projectsQuery.isLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : projectsQuery.isError ? (
                <ErrorState message="Could not load projects." onRetry={() => projectsQuery.refetch()} />
              ) : (projectsQuery.data ?? []).length === 0 ? (
                <EmptyState title="No projects available" description="Create a project before assigning employee access." />
              ) : (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {(projectsQuery.data ?? []).map((project) => {
                    const checked = selectedProjectIds.includes(project.id);
                    const taskLinked = projectTarget.projects.some(
                      (item) => item.id === project.id && item.assignment_source !== "admin",
                    );
                    const isManaged = project.project_manager_id === projectTarget.id;
                    return (
                      <div
                        key={project.id}
                        className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
                          checked ? "border-accent/35 bg-accent-soft/60" : "border-border bg-surface"
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={checked} onChange={() => toggleProject(project.id)} className="h-4 w-4 accent-[var(--accent)]" />
                        </label>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-fg">{project.name}</span>
                          <span className="mt-0.5 block text-xs capitalize text-fg-muted">{project.status.replace("_", " ")} · Lead: {project.project_manager_name ?? "Not assigned"}</span>
                        </span>
                        {taskLinked && <Badge variant="outline" className="text-[10px]">Task-linked</Badge>}
                        {isManaged ? <Badge variant="success" className="text-[10px]"><BadgeCheck className="h-3 w-3" /> Managed</Badge> : isPrimaryAdmin && canReceiveLeadership ? (
                          <Button type="button" variant="outline" size="sm" disabled={managerSavingProjectId != null} onClick={() => handleAssignProjectManager(project)}>
                            {managerSavingProjectId === project.id ? <Spinner /> : <UserRoundCog className="h-3.5 w-3.5" />} Assign as lead
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {isPrimaryAdmin && !canReceiveLeadership && (
                <div className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-fg-muted">
                  To assign project leadership, first use <strong>Access &amp; role</strong> to give this active employee an enabled Administrator account or a Project Manager account with read &amp; write permission.
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg bg-raised/60 px-3 py-2 text-sm">
                <span className="text-fg-muted">Direct workspace access</span>
                <span className="font-semibold text-fg">{selectedProjectIds.length} selected</span>
              </div>
              {projectError && <p className="text-sm text-danger">{projectError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProjectTarget(null)}>Cancel</Button>
              <Button
                onClick={handleProjectAssignments}
                disabled={projectSaving || projectsQuery.isLoading || projectsQuery.isError}
              >
                {projectSaving ? <Spinner /> : <FolderPlus className="h-4 w-4" />}
                Save assignments
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Employee credentials and permission dialog */}
      {credentialTarget && (
        <Dialog open onOpenChange={() => setCredentialTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                TrackerX access · {credentialTarget.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-border bg-raised/50 p-3 text-sm text-fg-muted">
                Login identity, portal role, and permission are separate from the employee’s job title. A new or reset password is temporary and must be replaced after sign-in.
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="credential-email">Login email</Label>
                <Input
                  id="credential-email"
                  type="email"
                  value={credentialEmail}
                  onChange={(event) => setCredentialEmail(event.target.value)}
                  placeholder="employee@company.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="credential-password">
                  {credentialTarget.has_login ? "Reset temporary password" : "Temporary password"}
                </Label>
                <PasswordInput
                  id="credential-password"
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  minLength={credentialTarget.has_login ? undefined : 12}
                  maxLength={128}
                  placeholder={credentialTarget.has_login ? "Leave blank to keep current password" : "12+ characters; use 3 character types"}
                />
              </div>
              {isPrimaryAdmin ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="credential-role">Account role</Label>
                  <Select
                    id="credential-role"
                    value={accountRole}
                    onChange={(event) => {
                      const nextRole = event.target.value as EmployeeAccountRole;
                      setAccountRole(nextRole);
                      if (nextRole === "admin" || nextRole === "pm") setAccessLevel("write");
                    }}
                  >
                    <option value="developer">Employee</option>
                    <option value="pm">Project manager</option>
                    <option value="admin">Administrator</option>
                  </Select>
                  <p className="text-xs text-fg-muted">
                    Only the owner can grant or remove project-manager and administrator roles.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-raised/50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Account role</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-fg">
                    {accountRole === "pm" ? "Project manager" : accountRole === "admin" ? "Administrator" : "Employee"}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">The primary admin controls role changes.</p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="credential-access">Permission</Label>
                <Select
                  id="credential-access"
                  value={accessLevel}
                  disabled={accountRole === "admin" || accountRole === "pm"}
                  onChange={(event) => setAccessLevel(event.target.value as "read" | "write")}
                >
                  <option value="read">Read only</option>
                  <option value="write">Read &amp; write</option>
                </Select>
                <p className="text-xs text-fg-muted">
                  {accountRole === "admin" || accountRole === "pm"
                    ? `${accountRole === "admin" ? "Administrator" : "Project Manager"} accounts require read and write permission.`
                    : "Write permission enables the actions available to this account role."}
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm font-medium text-fg">
                <input
                  type="checkbox"
                  checked={loginEnabled}
                  onChange={(event) => setLoginEnabled(event.target.checked)}
                />
                Login enabled
              </label>
              {credentialError && <p className="text-sm text-danger">{credentialError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCredentialTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleCredentials} disabled={credentialSaving}>
                {credentialSaving && <Spinner />} Save access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function WorkforceMetric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return <div className="flex items-center gap-3 px-5 py-4">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="h-5 w-5" /></span>
    <span><span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{label}</span><span className="mt-0.5 flex items-baseline gap-2"><strong className="font-display text-xl text-fg">{value}</strong><span className="text-xs text-fg-muted">{detail}</span></span></span>
  </div>;
}

function EmployeeRow({
  member,
  isDeactivated,
  isAdmin,
  isPrimaryAdmin,
  onViewProfile,
  onEdit,
  onDelete,
  onDelegate,
  onCredentials,
  onProjects,
}: {
  member: TeamMember;
  isDeactivated: boolean;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  onViewProfile: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDelegate: () => void;
  onCredentials: () => void;
  onProjects: () => void;
}) {
  const isOwner = member.is_primary_admin;
  const openTasks = member.total_tasks - member.done_tasks;
  const managedProjects = member.projects.filter((project) => project.leadership_role === "project_manager");
  const initials = member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const canManageAccount = isPrimaryAdmin || (member.account_role !== "admin" && member.account_role !== "pm");
  const canEditProfile = isPrimaryAdmin || !member.is_primary_admin;

  return (
    <div className={`grid gap-4 p-4 transition-colors hover:bg-raised/30 md:grid-cols-[minmax(210px,1.3fr)_140px_minmax(170px,1fr)_auto] md:items-center ${isDeactivated ? "opacity-55" : ""}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-sm font-bold text-accent">{initials}</span>
        <button
          type="button"
          className="min-w-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onViewProfile}
        >
          <span className="flex flex-wrap items-center gap-1.5"><span className="truncate font-semibold text-fg hover:text-accent">{member.name}</span>{isOwner && <Badge className="bg-accent text-white">Owner</Badge>}{member.account_role === "pm" && <Badge variant="success">PM</Badge>}{isDeactivated && <Badge variant="neutral">Inactive</Badge>}</span>
          <span className="mt-0.5 block truncate text-xs text-fg-muted">ID {member.employee_number} · {member.role ?? "Job role not set"}</span>
          {member.name_arabic && <span className="mt-0.5 block truncate text-xs text-fg-subtle" dir="rtl" lang="ar">{member.name_arabic}</span>}
        </button>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Employment</p>
        <p className="mt-1 text-sm font-semibold text-fg">{employmentLabel(member.employment_type)}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted"><Clock3 className="h-3 w-3" /> {member.weekly_hours != null ? `${member.weekly_hours} hours / week` : "Hours not set"}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs"><span className="text-fg-muted">Workload</span><span className="font-semibold text-fg">{openTasks} open · {member.active_est_days}d</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, member.total_tasks ? (member.done_tasks / member.total_tasks) * 100 : 0)}%` }} /></div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{member.projects.length} project{member.projects.length === 1 ? "" : "s"}</Badge>
          {managedProjects.length > 0 && <Badge variant="success">Leads {managedProjects.length}</Badge>}
          <Badge variant={member.login_enabled ? "neutral" : "outline"}>{accountRoleLabel(member.account_role)}{member.has_login ? ` · ${member.login_enabled ? member.access_level : "disabled"}` : ""}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 md:w-[156px] md:justify-end">
        <Button variant="outline" size="sm" onClick={onViewProfile}><UserCircle className="h-3.5 w-3.5" /> Profile</Button>
        {isAdmin && (isDeactivated ? <Button variant="outline" size="sm" onClick={onDelegate}><Users className="h-3.5 w-3.5" /> Delegate</Button> : <>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={onProjects}><FolderPlus className="h-3.5 w-3.5" /> {isPrimaryAdmin && (member.account_role === "pm" || member.account_role === "admin") ? "Projects & leadership" : "Project scope"}</Button>
          {canManageAccount && <Button variant="outline" size="sm" className="w-full justify-start" onClick={onCredentials}><KeyRound className="h-3.5 w-3.5" /> Access & role</Button>}
          <span className="ml-auto flex">
            {canEditProfile && <Button variant="ghost" size="icon" aria-label={`Edit ${member.name}`} title="Edit employment profile" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>}
            {!isOwner && <Button variant="ghost" size="icon" aria-label={`Deactivate ${member.name}`} title="Deactivate employee" className="text-fg-subtle hover:bg-danger/10 hover:text-danger" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </span>
        </>)}
      </div>
    </div>
  );
}
