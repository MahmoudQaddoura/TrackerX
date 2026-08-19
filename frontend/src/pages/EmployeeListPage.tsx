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
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileArchive,
  FolderKanban,
  FolderPlus,
  KeyRound,
  ListChecks,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCircle,
  UserCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  assignMemberProjects,
  createMember,
  delegateMemberTasks,
  deleteMember,
  provisionMemberCredentials,
  updateMember,
  type TeamMemberPayload,
} from "@/api/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/KpiCard";
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
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import { useProjects } from "@/hooks/useProjects";
import { getApiErrorMessage } from "@/lib/apiClient";
import { timeGreeting } from "@/lib/greeting";
import { useQueryClient } from "@tanstack/react-query";
import type { EmployeeAccountRole, TeamMember } from "@/types";

type ProfileView = { member: TeamMember } | null;

export function EmployeeListPage() {
  const { isAdmin, isPrimaryAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { data: members, isLoading, isError, refetch } = useTeam();
  const projectsQuery = useProjects();
  const [profile, setProfile] = useState<ProfileView>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Delegate state
  const [delegateTarget, setDelegateTarget] = useState<TeamMember | null>(null);
  const [toMemberId, setToMemberId] = useState<number | null>(null);
  const [delegating, setDelegating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const rows = members ?? [];
  const allActiveMembers = rows.filter((m) => m.is_active);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (member: TeamMember) =>
    !normalizedSearch ||
    member.name.toLowerCase().includes(normalizedSearch) ||
    member.role?.toLowerCase().includes(normalizedSearch) ||
    member.projects.some((project) => project.name.toLowerCase().includes(normalizedSearch));
  const activeMembers = allActiveMembers.filter(matchesSearch);
  const deactivatedMembers = rows.filter((m) => !m.is_active && matchesSearch(m));
  const assignedProjectCount = new Set(rows.flatMap((member) => member.projects.map((project) => project.id))).size;
  const linkedLogins = rows.filter((member) => member.has_login && member.login_enabled).length;
  const openTasks = rows.reduce((total, member) => total + member.total_tasks - member.done_tasks, 0);

  function openCreate() {
    setEditing(null);
    setName("");
    setRole("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditing(member);
    setName(member.name);
    setRole(member.role ?? "");
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
    if (!credentialTarget.has_login && temporaryPassword.length < 8)
      return setCredentialError("A temporary password of at least 8 characters is required.");
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
      const payload: TeamMemberPayload = { name: name.trim(), role: role.trim() || null };
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
      <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent via-accent to-accent-hover px-6 py-6 text-white shadow-lg">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge className="border border-white/20 bg-white/10 text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> Employee control center
            </Badge>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
              {timeGreeting()}, {user?.full_name ?? "Manager"}
            </h1>
            <p className="mt-1 text-sm text-white/75">
              Keep people, assigned projects, workload, credentials, and access in one current view.
            </p>
          </div>
          <Button size="sm" className="bg-white text-accent hover:bg-white/90" asChild>
            <Link to="/attendance">Open attendance <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active employees" value={allActiveMembers.length} description="Current team members" icon={UserCheck} />
        <KpiCard label="Assigned projects" value={assignedProjectCount} description="Admin and task-linked access" icon={BriefcaseBusiness} />
        <KpiCard label="Enabled logins" value={`${linkedLogins}/${rows.length}`} description="Employees with TrackerX access" icon={KeyRound} accent="success" />
        <KpiCard label="Open assignments" value={openTasks} description="Tasks not completed" icon={ListChecks} />
      </div>
      <div className="relative sm:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <Input className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search people, roles, or projects" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-fg">Employee directory</h2>
          <p className="text-sm text-fg-muted">
            {allActiveMembers.length} active · {rows.length - allActiveMembers.length} deactivated
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input className="w-72 pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search people, roles, or projects" />
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add employee
            </Button>
          )}
        </div>
      </div>

      {/* ---- Active Employees ---- */}
      {activeMembers.length === 0 ? (
        <EmptyState
          title="No active employees"
          description={normalizedSearch ? "No employee matches this search." : "Import a CSV or add one from the button above."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeMembers.map((m) => (
            <EmployeeCard
              key={m.id}
              member={m}
              isDeactivated={false}
              isAdmin={isAdmin}
              onViewProfile={() => setProfile({ member: m })}
              onEdit={() => openEdit(m)}
              onDelete={() => handleDelete(m)}
              onDelegate={() => openDelegate(m)}
              onCredentials={() => openCredentials(m)}
              onProjects={() => openProjectAssignments(m)}
            />
          ))}
        </div>
      )}

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
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deactivatedMembers.map((m) => (
                <EmployeeCard
                  key={m.id}
                  member={m}
                  isDeactivated
                  isAdmin={isAdmin}
                  onViewProfile={() => setProfile({ member: m })}
                  onEdit={() => openEdit(m)}
                  onDelete={() => handleDelete(m)}
                  onDelegate={() => openDelegate(m)}
                  onCredentials={() => openCredentials(m)}
                  onProjects={() => openProjectAssignments(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile drill-down dialog */}
      {profile && <ProfileDialog member={profile.member} onClose={() => setProfile(null)} />}

      {/* Create / Edit form dialog */}
      {formOpen && (
        <Dialog open onOpenChange={() => setFormOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-name">Name</Label>
                <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-role">Role</Label>
                <Input
                  id="e-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Backend Engineer"
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
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
                        {m.name}
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
                Assign projects · {projectTarget.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-accent/15 bg-accent-soft p-3 text-sm text-fg-muted">
                Selected projects become available in this employee’s TrackerX workspace. Task-linked access is shown separately and remains available while the employee has assigned work.
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
                    return (
                      <label
                        key={project.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                          checked ? "border-accent bg-accent-soft" : "border-border hover:bg-raised/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProject(project.id)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-fg">{project.name}</span>
                          <span className="mt-0.5 block text-xs capitalize text-fg-muted">{project.status.replace("_", " ")}</span>
                        </span>
                        {taskLinked && <Badge variant="outline" className="text-[10px]">Task-linked</Badge>}
                        {checked && <Badge variant="success" className="text-[10px]">Admin assigned</Badge>}
                      </label>
                    );
                  })}
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
                The admin controls this employee’s login and permission. A new or reset password is temporary, and the employee must replace it after signing in.
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
                  placeholder={credentialTarget.has_login ? "Leave blank to keep current password" : "Minimum 8 characters"}
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
                      if (nextRole === "admin") setAccessLevel("write");
                    }}
                  >
                    <option value="developer">Employee</option>
                    <option value="pm">Project manager</option>
                    <option value="admin">Administrator</option>
                  </Select>
                  <p className="text-xs text-fg-muted">
                    Only the primary admin can assign project-manager or administrator roles.
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
                  disabled={accountRole === "admin"}
                  onChange={(event) => setAccessLevel(event.target.value as "read" | "write")}
                >
                  <option value="read">Read only</option>
                  <option value="write">Read &amp; write</option>
                </Select>
                <p className="text-xs text-fg-muted">
                  {accountRole === "admin"
                    ? "Administrator accounts always have read and write permission."
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

// ---------- Card Component ----------

function EmployeeCard({
  member,
  isDeactivated,
  isAdmin,
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
  onViewProfile: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDelegate: () => void;
  onCredentials: () => void;
  onProjects: () => void;
}) {
  const isOwner = member.role === "Owner";

  return (
    <Card className={isDeactivated ? "opacity-50" : ""}>
      <CardContent className="flex items-center gap-3 pt-5">
        <button
          type="button"
          className="flex flex-1 items-center gap-3 text-left"
          onClick={onViewProfile}
        >
          <UserCircle className="h-8 w-8 text-fg-muted shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="truncate font-medium text-fg">{member.name}</p>
              {isOwner && (
                <Badge
                  variant="neutral"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-700 text-[10px]"
                >
                  Owner
                </Badge>
              )}
              {member.account_role === "admin" && (
                <Badge variant="success" className="text-[10px]">
                  Admin privileges
                </Badge>
              )}
              {member.is_primary_admin && (
                <Badge variant="default" className="text-[10px]">
                  Primary admin
                </Badge>
              )}
              {isDeactivated && !isOwner && (
                <span className="text-[10px] text-fg-subtle">· Inactive</span>
              )}
            </div>
            <p className="text-xs text-fg-muted">{member.role ?? "—"}</p>
            <p className="text-xs text-fg-subtle">
              {member.task_count} task{member.task_count !== 1 ? "s" : ""}
              {member.has_login && (
                <Badge variant="neutral" className="ml-1 text-[10px]">
                  {member.login_enabled ? member.access_level : "disabled"}
                </Badge>
              )}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              {member.projects.length} assigned project{member.projects.length !== 1 ? "s" : ""}
            </p>
            {member.projects.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {member.projects.slice(0, 2).map((project) => (
                  <Badge key={project.id} variant="outline" className="max-w-[150px] truncate text-[10px]">
                    {project.name}
                  </Badge>
                ))}
                {member.projects.length > 2 && <Badge variant="neutral" className="text-[10px]">+{member.projects.length - 2}</Badge>}
              </div>
            )}
          </div>
        </button>
        {isAdmin && (
          <div className="flex gap-0.5">
            {isDeactivated ? (
              <Button variant="outline" size="sm" onClick={onDelegate}>
                <Users className="h-3.5 w-3.5" /> Delegate
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  title="Assign project workspaces"
                  onClick={onProjects}
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Projects
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Manage ${member.name} credentials`}
                  title="Credentials and access"
                  onClick={onCredentials}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Profile Dialog ----------

function ProfileDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const isOwner = member.role === "Owner";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            {member.name}
            {isOwner && (
              <Badge
                variant="neutral"
                className="ml-1 border-amber-500/50 bg-amber-500/10 text-amber-700 text-[11px]"
              >
                Owner
              </Badge>
            )}
            {member.account_role === "admin" && (
              <Badge variant="success" className="ml-1 text-[11px]">
                Admin privileges
              </Badge>
            )}
            {member.is_primary_admin && (
              <Badge variant="default" className="ml-1 text-[11px]">
                Primary admin
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-raised/60 p-3">
              <span className="text-fg-muted">Role</span>
              <p className="font-medium">{member.role ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-raised/60 p-3">
              <span className="text-fg-muted">Status</span>
              <p className="font-medium">{member.is_active ? "Active" : "Inactive"}</p>
            </div>
            <div className="rounded-lg bg-raised/60 p-3">
              <span className="text-fg-muted">Task progress</span>
              <p className="font-medium">{member.done_tasks}/{member.total_tasks}</p>
            </div>
            <div className="rounded-lg bg-raised/60 p-3">
              <span className="text-fg-muted">Active effort</span>
              <p className="font-medium">{member.active_est_days} days</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="font-medium text-fg">TrackerX access</p>
              <p className="text-xs text-fg-muted">{member.login_email ?? "No login has been created"}</p>
            </div>
            <Badge variant={member.login_enabled ? "success" : "outline"}>
              {member.login_enabled
                ? member.account_role === "admin"
                  ? "Administrator · Read & write"
                  : member.access_level
                : "No active login"}
            </Badge>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-fg">Assigned project workspaces</p>
                <p className="text-xs text-fg-muted">Access assigned by an admin or linked through active task work.</p>
              </div>
              <Badge variant="neutral">{member.projects.length} projects</Badge>
            </div>
            {member.projects.length > 0 ? (
              <div className="space-y-2">
                {member.projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 font-medium text-fg">
                      <FolderKanban className="h-4 w-4 text-accent" /> {project.name}
                      <Badge variant={project.assignment_source === "task" ? "outline" : "success"} className="text-[10px]">
                        {project.assignment_source === "task" ? "Task-linked" : project.assignment_source === "admin_and_task" ? "Admin + task" : "Admin assigned"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { tab: "overview", label: "Overview", icon: CheckCircle2 },
                        { tab: "kanban", label: "Tasks", icon: ListChecks },
                        { tab: "gantt", label: "Gantt", icon: CalendarRange },
                        { tab: "documents", label: "Documents", icon: FileArchive },
                        { tab: "meetings", label: "Meetings", icon: MessagesSquare },
                      ].map(({ tab, label, icon: Icon }) => (
                        <Button key={tab} variant="outline" size="sm" asChild>
                          <Link to={`/projects/${project.id}?tab=${tab}`} onClick={onClose}>
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-fg-muted">
                No project access yet. An admin can assign a workspace from this employee’s card.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
