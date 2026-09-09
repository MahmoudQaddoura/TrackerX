import { Check, UserRoundCog } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useProjectMutations } from "@/hooks/useProjects";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { Project, TeamMember } from "@/types";

export function ProjectManagerDialog({
  project,
  members,
  onClose,
}: {
  project: Project | null;
  members: TeamMember[];
  onClose: () => void;
}) {
  const { updateManager } = useProjectMutations();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeMembers = members.filter(
    (member) => member.is_active && member.account_role === "pm" && member.access_level === "write" && member.login_enabled,
  );

  useEffect(() => {
    setSelectedMemberId(null);
    setError(null);
  }, [project?.id]);

  async function assign(member: TeamMember) {
    if (!project || member.id === project.project_manager_id) return;
    setSelectedMemberId(member.id);
    setError(null);
    try {
      await updateManager.mutateAsync({
        id: project.id,
        payload: { project_manager_id: member.id },
      });
      onClose();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not assign this Project Manager."));
    } finally {
      setSelectedMemberId(null);
    }
  }

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-accent" />
            Assign Project Manager
          </DialogTitle>
        </DialogHeader>
        {project && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-raised/50 px-3 py-2.5">
              <p className="font-medium text-fg">{project.name}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                Choose an enabled Project Manager with read and write permission. The change is saved immediately.
              </p>
            </div>

            {activeMembers.length === 0 ? (
              <EmptyState title="No eligible project managers" description="The owner must first grant an active employee the Project Manager role and read & write permission." />
            ) : (
              <div className="max-h-[430px] space-y-1.5 overflow-y-auto pr-1">
                {activeMembers.map((member) => {
                  const isCurrent = member.id === project.project_manager_id;
                  const isSaving = selectedMemberId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => assign(member)}
                      disabled={updateManager.isPending || isCurrent}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isCurrent
                          ? "border-success/35 bg-success/5"
                          : "border-border hover:border-accent/40 hover:bg-accent-soft/40"
                      } disabled:cursor-default`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isCurrent ? "bg-success/15 text-success" : "bg-raised text-fg-muted"}`}>
                        {isSaving ? <Spinner className="h-4 w-4" /> : isCurrent ? <Check className="h-4 w-4" /> : <UserRoundCog className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-fg">{member.name}</span>
                        <span className="block truncate text-xs text-fg-muted">{member.role ?? "Employee"}</span>
                      </span>
                      {isCurrent && <Badge variant="success">Current PM</Badge>}
                    </button>
                  );
                })}
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
