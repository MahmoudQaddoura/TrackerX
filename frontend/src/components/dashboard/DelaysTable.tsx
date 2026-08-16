/**
 * dashboard/DelaysTable.tsx
 * Delayed tasks with their cause. Long delay notes truncate with a "View" that
 * opens the full note in a dialog.
 */
import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
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
  onOpenTask,
}: {
  data: DelayedTaskItem[];
  showProject?: boolean;
  onOpenTask?: (task: DelayedTaskItem) => void;
}) {
  const [note, setNote] = useState<DelayedTaskItem | null>(null);

  return (
    <Card id="delay-alerts" className={data.length > 0 ? "border-danger/30" : undefined}>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={data.length > 0 ? "h-5 w-5 text-danger" : "h-5 w-5 text-success"} />
            Delay alert center
          </CardTitle>
          <p className="mt-1 text-xs text-fg-muted">Manual delay flags and automatic past-due triggers</p>
        </div>
        <Badge variant={data.length > 0 ? "danger" : "success"}>
          {data.length > 0 ? `${data.length} active` : "All clear"}
        </Badge>
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
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 pr-4 font-medium">Note</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                  {onOpenTask && <th className="py-2 text-right font-medium">Action</th>}
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
                    <td className="py-2 pr-4">
                      <Badge variant={t.trigger_type === "schedule" ? "danger" : "warning"}>
                        {t.trigger_type === "schedule" ? (
                          <><Clock3 className="h-3 w-3" /> Past due</>
                        ) : "Flagged"}
                      </Badge>
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
                    <td className="py-2 pr-4 text-fg-muted">
                      <span>{formatDate(t.end_date)}</span>
                      {t.days_overdue != null && t.days_overdue > 0 && (
                        <span className="ml-2 text-xs font-medium text-danger">{t.days_overdue}d late</span>
                      )}
                    </td>
                    {onOpenTask && (
                      <td className="py-2 text-right">
                        <button
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                          onClick={() => onOpenTask(t)}
                        >
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
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
