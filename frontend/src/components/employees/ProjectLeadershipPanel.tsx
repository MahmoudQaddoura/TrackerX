import { BriefcaseBusiness, ShieldCheck, UserRoundCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useProjectMutations } from "@/hooks/useProjects";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { Project, TeamMember } from "@/types";

interface LeadershipDraft {
  managerId: string;
  assistantId: string;
}

function leadershipDraft(project: Project): LeadershipDraft {
  return {
    managerId: project.project_manager_id ? String(project.project_manager_id) : "",
    assistantId: project.assistant_project_manager_id
      ? String(project.assistant_project_manager_id)
      : "",
  };
}

export function ProjectLeadershipPanel({
  projects,
  members,
  canEdit,
}: {
  projects: Project[];
  members: TeamMember[];
  canEdit: boolean;
}) {
  const { updateLeadership } = useProjectMutations();
  const [drafts, setDrafts] = useState<Record<number, LeadershipDraft>>({});
  const [savingProjectId, setSavingProjectId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(projects.map((project) => [project.id, leadershipDraft(project)])));
  }, [projects]);

  const leadershipCandidates = useMemo(
    () => members.filter(
      (member) =>
        member.is_active
        && member.login_enabled
        && member.access_level === "write"
        && (member.account_role === "admin" || member.account_role === "pm"),
    ),
    [members],
  );
  const assignedCount = projects.filter((project) => project.project_manager_id).length;

  function updateDraft(projectId: number, field: keyof LeadershipDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? { managerId: "", assistantId: "" }),
        [field]: value,
      },
    }));
    setErrors((current) => ({ ...current, [projectId]: "" }));
  }

  async function save(project: Project) {
    const draft = drafts[project.id] ?? leadershipDraft(project);
    if (!draft.managerId) {
      setErrors((current) => ({ ...current, [project.id]: "Select a Project Manager before saving." }));
      return;
    }
    if (draft.managerId === draft.assistantId) {
      setErrors((current) => ({
        ...current,
        [project.id]: "The Project Manager and Assistant Project Manager must be different employees.",
      }));
      return;
    }
    setSavingProjectId(project.id);
    setErrors((current) => ({ ...current, [project.id]: "" }));
    try {
      await updateLeadership.mutateAsync({
        id: project.id,
        payload: {
          project_manager_id: Number(draft.managerId),
          assistant_project_manager_id: draft.assistantId ? Number(draft.assistantId) : null,
        },
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [project.id]: getApiErrorMessage(error, "Could not update project leadership."),
      }));
    } finally {
      setSavingProjectId(null);
    }
  }

  return (
    <Card className="overflow-hidden border-accent/20">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-accent-soft/35 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <UserRoundCog className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">Project leadership</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Assign one accountable Project Manager and an optional Assistant Project Manager to every project.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={assignedCount === projects.length && projects.length > 0 ? "success" : "warning"}>
            {assignedCount}/{projects.length} projects assigned
          </Badge>
          <Badge variant="outline"><ShieldCheck className="h-3.5 w-3.5" />Owner controlled</Badge>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="p-5 text-sm text-fg-muted">Create a project before assigning project leadership.</p>
      ) : (
        <div className="divide-y divide-border">
          {projects.map((project) => {
            const draft = drafts[project.id] ?? leadershipDraft(project);
            const changed = draft.managerId !== (project.project_manager_id ? String(project.project_manager_id) : "")
              || draft.assistantId !== (project.assistant_project_manager_id ? String(project.assistant_project_manager_id) : "");
            return (
              <div key={project.id} className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(230px,1fr)_minmax(220px,0.75fr)_minmax(220px,0.75fr)_auto] xl:items-end">
                <div className="min-w-0 self-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 shrink-0 text-accent" />
                    <p className="truncate font-semibold text-fg">{project.name}</p>
                    {!project.project_manager_id && <Badge variant="warning">PM required</Badge>}
                  </div>
                  <p className="mt-1 text-xs capitalize text-fg-muted">
                    {project.project_type === "maintenance_support" ? "Maintenance & Support" : "Actual project"} · {project.status.replace("_", " ")}
                  </p>
                </div>

                {canEdit ? (
                  <>
                    <label className="space-y-1.5 text-xs font-medium text-fg-muted">
                      Project Manager
                      <Select value={draft.managerId} onChange={(event) => updateDraft(project.id, "managerId", event.target.value)}>
                        <option value="">Select Project Manager...</option>
                        {leadershipCandidates.map((member) => (
                          <option key={member.id} value={member.id}>{member.name} · {member.account_role === "admin" ? "Admin" : "PM"}</option>
                        ))}
                      </Select>
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-fg-muted">
                      Assistant Project Manager
                      <Select value={draft.assistantId} onChange={(event) => updateDraft(project.id, "assistantId", event.target.value)}>
                        <option value="">No assistant assigned</option>
                        {leadershipCandidates.filter((member) => String(member.id) !== draft.managerId).map((member) => (
                          <option key={member.id} value={member.id}>{member.name} · {member.account_role === "admin" ? "Admin" : "PM"}</option>
                        ))}
                      </Select>
                    </label>
                    <Button size="sm" onClick={() => save(project)} disabled={!changed || savingProjectId === project.id}>
                      {savingProjectId === project.id && <Spinner className="h-4 w-4" />}
                      Save leadership
                    </Button>
                  </>
                ) : (
                  <div className="xl:col-span-3 grid gap-3 sm:grid-cols-2">
                    <LeadershipValue label="Project Manager" value={project.project_manager_name} />
                    <LeadershipValue label="Assistant Project Manager" value={project.assistant_project_manager_name} />
                  </div>
                )}
                {errors[project.id] && <p className="text-sm text-danger xl:col-start-2 xl:col-span-3">{errors[project.id]}</p>}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && leadershipCandidates.length < 2 && (
        <p className="border-t border-warning/20 bg-warning/5 px-5 py-3 text-xs text-fg-muted">
          Leadership candidates need an enabled Administrator or Project Manager account with read and write permission. Use Credentials on an employee card to prepare additional candidates.
        </p>
      )}
    </Card>
  );
}

function LeadershipValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-raised/40 px-3 py-2">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 font-medium text-fg">{value ?? "Not assigned"}</p>
    </div>
  );
}
