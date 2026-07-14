/**
 * common/CommentThread.tsx
 * Comments on a task or milestone. Admin, pm, and client can post (client
 * feedback works like a client note). A comment can be removed by its
 * author or by an admin/pm.
 */
import { Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useCommentMutations, useComments } from "@/hooks/useComments";
import { formatDate } from "@/lib/utils";
import type { CommentEntity } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  pm: "PM",
  client: "Client",
};

export function CommentThread({
  entityType,
  entityId,
}: {
  entityType: CommentEntity;
  entityId: number;
}) {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useComments(entityType, entityId);
  const { create, remove } = useCommentMutations(entityType, entityId);
  const [body, setBody] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await create.mutateAsync(body.trim());
    setBody("");
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading && <Skeleton className="h-16 w-full" />}
      {isError && <ErrorState message="Could not load comments." onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState title="No comments yet" description="Start the conversation below." />
      )}

      {data && data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-surface p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg">{c.author_name}</span>
                  <Badge variant={c.author_role === "client" ? "neutral" : "default"}>
                    {ROLE_LABELS[c.author_role] ?? c.author_role}
                  </Badge>
                  <span className="text-xs text-fg-subtle">{formatDate(c.created_at)}</span>
                </div>
                {(user?.id === c.author_id || user?.role === "admin" || user?.role === "pm") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete comment"
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-fg-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={create.isPending || !body.trim()}>
            {create.isPending && <Spinner />} Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
