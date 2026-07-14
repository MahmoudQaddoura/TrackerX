/**
 * team/TeamFormDialog.tsx
 * Admin-only: create/edit a team — name, function, lead (any pm account),
 * weekly capacity, and which project(s) it's assigned to.
 */
import { FormEvent, useEffect, useState } from "react";

import { type TeamPayload } from "@/api/teams";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useProjects } from "@/hooks/useProjects";
import { useUsers } from "@/hooks/useUsers";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { Team } from "@/types";

export function TeamFormDialog({
  open,
  onOpenChange,
  team,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  onSubmit: (payload: TeamPayload) => Promise<unknown>;
  isPending?: boolean;
}) {
  const { data: users } = useUsers(open);
  const { data: projects } = useProjects();
  const pmUsers = (users ?? []).filter((u) => u.role === "pm");

  const [name, setName] = useState("");
  const [func, setFunc] = useState("");
  const [leadUserId, setLeadUserId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setFunc(team?.function ?? "");
      setLeadUserId(team?.lead_user_id != null ? String(team.lead_user_id) : "");
      setCapacity(team?.weekly_capacity_days != null ? String(team.weekly_capacity_days) : "");
      setProjectIds(team?.project_ids ?? []);
      setError(null);
    }
  }, [open, team]);

  function toggleProject(id: number) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    try {
      await onSubmit({
        name: name.trim(),
        function: func.trim() || null,
        lead_user_id: leadUserId ? Number(leadUserId) : null,
        weekly_capacity_days: capacity ? Number(capacity) : null,
        project_ids: projectIds,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Edit team" : "New team"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tm-name">Name</Label>
            <Input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tm-func">Function</Label>
            <Input
              id="tm-func"
              value={func}
              onChange={(e) => setFunc(e.target.value)}
              placeholder="e.g. Software Engineering"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-lead">Team lead</Label>
              <Select id="tm-lead" value={leadUserId} onChange={(e) => setLeadUserId(e.target.value)}>
                <option value="">No lead yet</option>
                {pmUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </Select>
              {pmUsers.length === 0 && (
                <p className="text-xs text-fg-subtle">
                  No pm accounts exist yet — create one first.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-capacity">Weekly capacity (days)</Label>
              <Input
                id="tm-capacity"
                type="number"
                min="0"
                step="0.5"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Projects assigned to this team</Label>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
              {(projects ?? []).length === 0 && (
                <p className="text-sm text-fg-subtle">No projects exist yet.</p>
              )}
              {(projects ?? []).map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={projectIds.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
