import { Check, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useProjectMutations, useProjectTeam } from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeam";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectTeamDialog({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void }) {
  const roster = useProjectTeam(project.id, open);
  const directory = useTeam(true, open);
  const { updateTeam } = useProjectMutations();
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && roster.data) setSelected(roster.data.map((member) => member.id));
  }, [open, roster.data]);

  const candidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (directory.data ?? []).filter((member) => !query || `${member.name} ${member.role ?? ""} ${member.employee_number}`.toLocaleLowerCase().includes(query));
  }, [directory.data, search]);

  async function save() {
    setError(null);
    try {
      await updateTeam.mutateAsync({ id: project.id, memberIds: selected });
      onOpenChange(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not update the project team."));
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl gap-0 p-0">
      <DialogHeader className="border-b border-border bg-accent-soft/50 px-6 py-5 pr-12">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white"><UsersRound className="h-5 w-5" /></span><div><DialogTitle>Project team</DialogTitle><DialogDescription>{project.name} · Employees selected here become available for task assignment.</DialogDescription></div></div>
      </DialogHeader>
      <div className="space-y-4 px-6 py-5">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, role, or employee ID" /></div>
        <div className="flex items-center justify-between text-sm"><span className="font-medium text-fg">Working team</span><span className="text-fg-muted">{selected.length} selected</span></div>
        <div className="grid max-h-[360px] gap-2 overflow-y-auto sm:grid-cols-2">
          {candidates.map((member) => {
            const checked = selected.includes(member.id);
            const locked = member.id === project.project_manager_id;
            return <button key={member.id} type="button" onClick={() => !locked && setSelected((current) => checked ? current.filter((id) => id !== member.id) : [...current, member.id])} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors", checked ? "border-accent/40 bg-accent-soft" : "border-border hover:border-accent/25 hover:bg-raised")}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", checked ? "border-accent bg-accent text-white" : "border-border bg-surface text-transparent")}><Check className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-fg">{member.name}</span><span className="block truncate text-xs text-fg-muted">ID {member.employee_number} · {member.role ?? "Role not set"}{locked ? " · Project manager" : ""}</span></span>
            </button>;
          })}
        </div>
        {error && <p className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
      <DialogFooter className="border-t border-border px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={updateTeam.isPending}>{updateTeam.isPending && <Spinner />} Save team</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
