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
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  UserCircle,
  Users,
} from "lucide-react";
import { useState } from "react";

import {
  createMember,
  delegateMemberTasks,
  deleteMember,
  updateMember,
  type TeamMemberPayload,
} from "@/api/team";
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
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import { useQueryClient } from "@tanstack/react-query";
import type { TeamMember } from "@/types";

type ProfileView = { member: TeamMember } | null;

export function EmployeeListPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: members, isLoading, isError, refetch } = useTeam();
  const [profile, setProfile] = useState<ProfileView>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);

  // Delegate state
  const [delegateTarget, setDelegateTarget] = useState<TeamMember | null>(null);
  const [toMemberId, setToMemberId] = useState<number | null>(null);
  const [delegating, setDelegating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const rows = members ?? [];
  const activeMembers = rows.filter((m) => m.is_active);
  const deactivatedMembers = rows.filter((m) => !m.is_active);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Employees</h1>
          <p className="text-sm text-fg-muted">
            {activeMembers.length} active · {deactivatedMembers.length} deactivated
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        )}
      </div>

      {/* ---- Active Employees ---- */}
      {activeMembers.length === 0 ? (
        <EmptyState
          title="No active employees"
          description="Import a CSV or add one from the button above."
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
                  {activeMembers
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
}: {
  member: TeamMember;
  isDeactivated: boolean;
  isAdmin: boolean;
  onViewProfile: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDelegate: () => void;
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
              {isDeactivated && !isOwner && (
                <span className="text-[10px] text-fg-subtle">· Inactive</span>
              )}
            </div>
            <p className="text-xs text-fg-muted">{member.role ?? "—"}</p>
            <p className="text-xs text-fg-subtle">
              {member.task_count} task{member.task_count !== 1 ? "s" : ""}
              {member.has_login && (
                <Badge variant="neutral" className="ml-1 text-[10px]">
                  login
                </Badge>
              )}
            </p>
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
      <DialogContent>
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
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-fg-muted">Role</span>
              <p className="font-medium">{member.role ?? "—"}</p>
            </div>
            <div>
              <span className="text-fg-muted">Status</span>
              <p className="font-medium">{member.is_active ? "Active" : "Inactive"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-fg-muted">Total tasks</span>
              <p className="font-medium">{member.total_tasks}</p>
            </div>
            <div>
              <span className="text-fg-muted">Done</span>
              <p className="font-medium">{member.done_tasks}</p>
            </div>
            <div>
              <span className="text-fg-muted">Est. days</span>
              <p className="font-medium">{member.active_est_days}</p>
            </div>
          </div>
          <div>
            <span className="text-fg-muted">Has login</span>
            <p className="font-medium">{member.has_login ? "Yes" : "No"}</p>
          </div>
          {member.projects.length > 0 && (
            <div>
              <span className="text-fg-muted">Projects</span>
              <ul className="list-disc pl-5 mt-1">
                {member.projects.map((p) => (
                  <li key={p.id} className="text-fg">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
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