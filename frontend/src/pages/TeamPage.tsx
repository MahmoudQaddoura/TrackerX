/**
 * pages/TeamPage.tsx
 * Team hierarchy: Team -> Team Lead -> Team Members. Admin creates teams
 * (name, function, lead, projects, capacity) and sees every team; a pm sees
 * only the team(s) they lead. Admin or that team's lead can grow/shrink the
 * roster; only admin edits/deletes team metadata or deactivates a person.
 */
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { AddMemberDialog } from "@/components/team/AddMemberDialog";
import { TeamFormDialog } from "@/components/team/TeamFormDialog";
import { UserCreateDialog } from "@/components/team/UserCreateDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import { useTeamMutations, useTeams } from "@/hooks/useTeams";
import { useUserMutations } from "@/hooks/useUsers";
import type { Team, TeamMember } from "@/types";

function loadBadge(loadPct: number | null): { label: string; variant: "neutral" | "success" | "warning" | "danger" } {
  if (loadPct == null) return { label: "Capacity not set", variant: "neutral" };
  if (loadPct <= 80) return { label: "On track", variant: "success" };
  if (loadPct <= 100) return { label: "Near capacity", variant: "warning" };
  return { label: "Overloaded", variant: "danger" };
}

export function TeamPage() {
  const { isAdmin } = useAuth();
  const { data: teams, isLoading, isError, refetch } = useTeams();
  const { data: members } = useTeam(false);
  const teamMut = useTeamMutations();

  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>();
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const userMut = useUserMutations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Team</h1>
          <p className="text-sm text-fg-muted">Teams, their leads, rosters, and workload.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUserDialogOpen(true)}>
              <UserPlus className="h-4 w-4" /> New login
            </Button>
            <Button
              onClick={() => {
                setEditingTeam(undefined);
                setTeamFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New team
            </Button>
          </div>
        )}
      </div>

      {isLoading && <Skeleton className="h-48 w-full" />}
      {isError && <ErrorState message="Could not load teams." onRetry={() => refetch()} />}
      {teams && teams.length === 0 && (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description={isAdmin ? "Create your first team to start assigning projects." : "Nothing here yet."}
        />
      )}

      <div className="flex flex-col gap-4">
        {teams?.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            allMembers={members ?? []}
            onEdit={() => {
              setEditingTeam(team);
              setTeamFormOpen(true);
            }}
            onDelete={() => setTeamToDelete(team)}
          />
        ))}
      </div>

      <TeamFormDialog
        open={teamFormOpen}
        onOpenChange={setTeamFormOpen}
        team={editingTeam}
        isPending={teamMut.create.isPending || teamMut.update.isPending}
        onSubmit={(payload) =>
          editingTeam
            ? teamMut.update.mutateAsync({ id: editingTeam.id, payload })
            : teamMut.create.mutateAsync(payload)
        }
      />
      <DeleteConfirmDialog
        open={!!teamToDelete}
        onOpenChange={(o) => !o && setTeamToDelete(null)}
        title="Delete team"
        description={`Delete "${teamToDelete?.name}"? Members keep their task history but leave the roster.`}
        isPending={teamMut.remove.isPending}
        onConfirm={() => {
          if (teamToDelete) teamMut.remove.mutate(teamToDelete.id, { onSuccess: () => setTeamToDelete(null) });
        }}
      />
      <UserCreateDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        isPending={userMut.create.isPending}
        onSubmit={(payload) => userMut.create.mutateAsync(payload)}
      />
    </div>
  );
}

function TeamCard({
  team,
  allMembers,
  onEdit,
  onDelete,
}: {
  team: Team;
  allMembers: TeamMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { isAdmin, user } = useAuth();
  const isLead = !!user && user.id === team.lead_user_id;
  const canManageRoster = isAdmin || isLead;

  const [expanded, setExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const teamMut = useTeamMutations();

  const roster = allMembers.filter((m) => m.team_id === team.id);
  const badge = loadBadge(team.load_pct);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-start gap-2 text-left"
          >
            {expanded ? (
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-fg-subtle" />
            ) : (
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-fg-subtle" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-fg">{team.name}</h3>
                {team.function && <Badge variant="neutral">{team.function}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-fg-muted">
                Led by {team.lead_name ?? "— no lead assigned —"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {team.project_names.length === 0 ? (
                  <span className="text-xs text-fg-subtle">No projects assigned</span>
                ) : (
                  team.project_names.map((name) => (
                    <Badge key={name} variant="outline">
                      {name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </button>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Edit team" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete team" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Members" value={team.member_count} />
          <Stat label="Total tasks" value={team.total_tasks} />
          <Stat label="Outstanding est." value={`${team.active_task_est_days}d`} />
          <div>
            <p className="text-xs uppercase text-fg-subtle">Load</p>
            {team.weekly_capacity_days ? (
              <>
                <Progress value={Math.min(team.load_pct ?? 0, 100)} className="mt-1 w-full" />
                <p className="mt-1 text-xs text-fg-muted">
                  {team.active_task_est_days}d / {team.weekly_capacity_days}d/wk
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-fg-subtle">Not set</p>
            )}
          </div>
        </div>
        <Badge variant={badge.variant} className="mt-3">
          {badge.label}
          {team.load_pct != null ? ` · ${team.load_pct}%` : ""}
        </Badge>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            {roster.length === 0 ? (
              <p className="text-sm text-fg-subtle">No members on this team yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-fg-subtle">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 pr-4 font-medium">Tasks</th>
                      <th className="py-2 pr-4 font-medium">Login</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      {canManageRoster && <th className="py-2 font-medium" />}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((m) => (
                      <tr key={m.id} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-medium text-fg">{m.name}</td>
                        <td className="py-2 pr-4 text-fg-muted">{m.role ?? "—"}</td>
                        <td className="py-2 pr-4 text-fg-muted">{m.task_count}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={m.has_login ? "success" : "neutral"}>
                            {m.has_login ? "Has login" : "No login"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant={m.is_active ? "success" : "neutral"}>
                            {m.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        {canManageRoster && (
                          <td className="py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove from team"
                              onClick={() =>
                                teamMut.detachMember.mutate({ teamId: team.id, memberId: m.id })
                              }
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canManageRoster && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Add member
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isPending={teamMut.attachMember.isPending}
        onSubmit={(payload) => teamMut.attachMember.mutateAsync({ teamId: team.id, payload })}
      />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase text-fg-subtle">{label}</p>
      <p className="text-lg font-semibold text-fg">{value}</p>
    </div>
  );
}
