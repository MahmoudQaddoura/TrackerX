/**
 * gantt/GanttChart.tsx
 * Thin wrapper around frappe-gantt. Re-renders when tasks or the view mode
 * change; colours are themed in globals.css (delayed bars turn red).
 */
import Gantt from "frappe-gantt";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { GanttTaskDTO } from "@/types";

type ViewMode = "Day" | "Week" | "Month";
const MODES: ViewMode[] = ["Day", "Week", "Month"];

export function GanttChart({ tasks }: { tasks: GanttTaskDTO[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>("Week");

  useEffect(() => {
    if (!ref.current || tasks.length === 0) return;
    ref.current.innerHTML = ""; // clear any previous render
    // eslint-disable-next-line no-new
    new Gantt(ref.current, tasks, {
      view_mode: mode,
      date_format: "YYYY-MM-DD",
      readonly: true,
      popup_on: "click",
      bar_height: 22,
    });
  }, [tasks, mode]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Timeline</CardTitle>
        {tasks.length > 0 && (
          <div className="flex gap-1">
            {MODES.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {m}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            title="No scheduled tasks"
            description="Add start and end dates to tasks to see them on the timeline."
          />
        ) : (
          <div className="overflow-x-auto">
            <div ref={ref} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
