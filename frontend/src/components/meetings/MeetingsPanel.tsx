/**
 * meetings/MeetingsPanel.tsx
 * Sprint / client meeting minutes for a project. Admin/PM can add/edit/
 * delete; everyone with project access can read. Filter by type.
 */
import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { MeetingFormDialog } from "@/components/meetings/MeetingFormDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useMeetingMutations, useMeetings } from "@/hooks/useMeetings";
import { formatDate } from "@/lib/utils";
import type { Meeting } from "@/types";

const FILTERS = [
  { key: undefined, label: "All" },
  { key: "sprint", label: "Sprint" },
  { key: "client", label: "Client" },
] as const;

export function MeetingsPanel({ projectId }: { projectId: number }) {
  const { canManage } = useAuth();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useMeetings(projectId, filter);
  const { create, update, remove } = useMeetingMutations(projectId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | undefined>();
  const [toDelete, setToDelete] = useState<Meeting | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add meeting
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className="h-28 w-full" />}
      {isError && <ErrorState message="Could not load meetings." onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No meetings recorded"
          description={canManage ? "Add sprint or client meeting minutes." : "Nothing here yet."}
        />
      )}

      {data &&
        data.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={m.meeting_type === "client" ? "warning" : "default"}>
                    {m.meeting_type === "client" ? "Client" : "Sprint"}
                  </Badge>
                  <h3 className="font-semibold text-fg">{m.title}</h3>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit meeting"
                      onClick={() => {
                        setEditing(m);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete meeting" onClick={() => setToDelete(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="mb-3 flex items-center gap-1 text-xs text-fg-subtle">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(m.meeting_date)}
              </p>
              {m.discussion_points && (
                <Section title="Discussion" body={m.discussion_points} />
              )}
              {m.outcome && <Section title="Outcome" body={m.outcome} className="mt-2" />}
            </CardContent>
          </Card>
        ))}

      <MeetingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        meeting={editing}
        isPending={create.isPending || update.isPending}
        onSubmit={(payload) =>
          editing
            ? update.mutateAsync({ id: editing.id, payload })
            : create.mutateAsync(payload)
        }
      />
      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete meeting"
        description={`Delete "${toDelete?.title}"?`}
        isPending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </div>
  );
}

function Section({ title, body, className }: { title: string; body: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase text-fg-subtle">{title}</p>
      <p className="whitespace-pre-wrap text-sm text-fg-muted">{body}</p>
    </div>
  );
}
