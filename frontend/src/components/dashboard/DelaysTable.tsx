/**
 * dashboard/DelaysTable.tsx
 * Delayed tasks with their cause. Long delay notes truncate with a "View" that
 * opens the full note in a dialog.
 */
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { DelayedTaskItem } from "@/types";

export function DelaysTable({
  data,
  showProject = true,
}: {
  data: DelayedTaskItem[];
  showProject?: boolean;
}) {
  const [note, setNote] = useState<DelayedTaskItem | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delayed tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState title="Everything is on track" description="No delayed tasks right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-fg-subtle">
                  {showProject && <th className="py-2 pr-4 font-medium">Project</th>}
                  <th className="py-2 pr-4 font-medium">Task</th>
                  <th className="py-2 pr-4 font-medium">Owner</th>
                  <th className="py-2 pr-4 font-medium">Cause</th>
                  <th className="py-2 pr-4 font-medium">Note</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.task_id} className="border-b border-border/60">
                    {showProject && <td className="py-2 pr-4 text-fg-muted">{t.project_name}</td>}
                    <td className="py-2 pr-4 text-fg">{t.task_title}</td>
                    <td className="py-2 pr-4 text-fg-muted">{t.owner ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {t.delay_cause && (
                        <Badge variant={t.delay_cause === "Client" ? "warning" : "danger"}>
                          {t.delay_cause}
                        </Badge>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-4 text-fg-muted">
                      {t.delay_comment ? (
                        <button className="text-accent hover:underline" onClick={() => setNote(t)}>
                          View
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4 text-fg-muted">{formatDate(t.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!note} onOpenChange={(o) => !o && setNote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{note?.task_title}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm text-fg-muted">{note?.delay_comment}</p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
