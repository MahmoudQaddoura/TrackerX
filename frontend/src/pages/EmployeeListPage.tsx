/**
 * pages/EmployeeListPage.tsx
 * Employee directory — admin & pm only.
 * Admin: full CRUD (create, edit, soft-delete).
 * PM: read-only list with profile drill-down.
 */
import { Pencil, Plus, Trash2, UserCircle, X } from "lucide-react";
import { useState } from "react";

import { createMember, deleteMember, updateMember, type TeamMemberPayload } from "@/api/team";
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
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import type { TeamMember } from "@/types";

type ProfileView = { member: TeamMember } | null;

export function EmployeeListPage() {
  const { isAdmin } = useAuth();
  const { data: members, isLoading, isError, refetch, mutate } = useTeam();
  const [profile, setProfile] = useState<ProfileView>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

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
      await mutate();
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
      await mutate();
    } catch {
      // ignore
    }
  }

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Could not load employees." onRetry={() => refetch()} />;

  const rows = members ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Employees</h1>
          <p className="text-sm text-fg-muted">
            {rows.length} employee{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No employees" description="Import a CSV or add one from the button above." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className={!m.is_active ? "opacity-50" : ""}>
              <CardContent className="flex items-center gap-3 pt-5">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => setProfile({ member: m })}
                >
                  <UserCircle className="h-8 w-8 text-fg-muted shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{m.name}</p>
                    <p className="text-xs text-fg-muted">
                      {m.role ?? "—"}
                      {!m.is_active && " · Inactive"}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {m.task_count} task{m.task_count !== 1 ? "s" : ""}
                      {m.has_login && <Badge variant="neutral" className="ml-1 text-[10px]">login</Badge>}
                    </p>
                  </div>
                </button>
                {isAdmin && (
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {m.is_active && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Profile drill-down dialog */}
      {profile && (
        <Dialog open onOpenChange={() => setProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                {profile.member.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-fg-muted">Role</span>
                  <p className="font-medium">{profile.member.role ?? "—"}</p>
                </div>
                <div>
                  <span className="text-fg-muted">Status</span>
                  <p className="font-medium">{profile.member.is_active ? "Active" : "Inactive"}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-fg-muted">Total tasks</span>
                  <p className="font-medium">{profile.member.total_tasks}</p>
                </div>
                <div>
                  <span className="text-fg-muted">Done</span>
                  <p className="font-medium">{profile.member.done_tasks}</p>
                </div>
                <div>
                  <span className="text-fg-muted">Est. days</span>
                  <p className="font-medium">{profile.member.active_est_days}</p>
                </div>
              </div>
              <div>
                <span className="text-fg-muted">Has login</span>
                <p className="font-medium">{profile.member.has_login ? "Yes" : "No"}</p>
              </div>
              {profile.member.projects.length > 0 && (
                <div>
                  <span className="text-fg-muted">Projects</span>
                  <ul className="list-disc pl-5 mt-1">
                    {profile.member.projects.map((p) => (
                      <li key={p.id} className="text-fg">{p.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfile(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                <Input id="e-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend Engineer" />
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
    </div>
  );
}
