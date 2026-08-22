import { UserRoundCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useTeam } from "@/hooks/useTeam";

export function AssigneePicker({
  selectedIds,
  onChange,
  disabled = false,
}: {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const { data: team } = useTeam(true);
  const selectedMembers = (team ?? []).filter((member) => selectedIds.includes(member.id));

  if (disabled) {
    return (
      <div className="flex flex-col gap-2">
        <Label>Assigned employees</Label>
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-border bg-raised/45 px-3 py-2">
          {selectedMembers.length ? (
            selectedMembers.map((member) => (
              <Badge key={member.id} variant="neutral">
                <UserRoundCheck className="h-3.5 w-3.5" /> {member.name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-fg-muted">No employee assigned yet.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Assigned employees</Label>
        <span className="text-xs text-fg-muted">{selectedIds.length} selected</span>
      </div>
      <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-border bg-input p-2 sm:grid-cols-2">
        {(team ?? []).map((member) => {
          const checked = selectedIds.includes(member.id);
          return (
            <label
              key={member.id}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors ${
                checked
                  ? "border-accent bg-accent-soft"
                  : "border-transparent hover:border-border hover:bg-raised"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== member.id)
                      : [...selectedIds, member.id],
                  )
                }
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{member.name}</span>
                {member.role && (
                  <span className="block truncate text-xs text-fg-subtle">{member.role}</span>
                )}
              </span>
            </label>
          );
        })}
        {team?.length === 0 && (
          <p className="p-2 text-sm text-fg-muted">No active employees available.</p>
        )}
      </div>
      <p className="text-xs text-fg-muted">
        Only administrators and project managers can change ownership.
      </p>
    </div>
  );
}
