import Gantt from "frappe-gantt";
import {
  CalendarClock,
  CircleDashed,
  ExternalLink,
  Filter,
  Rocket,
  Search,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import type { GanttTaskDTO, MilestoneWorkstream } from "@/types";

type ViewMode = "Day" | "Week" | "Month";
type WorkstreamFilter = "all" | MilestoneWorkstream;

const MODES: ViewMode[] = ["Day", "Week", "Month"];

export function GanttChart({
  tasks,
  onOpenMilestone,
  hideTeamDetails = false,
}: {
  tasks: GanttTaskDTO[];
  onOpenMilestone: (milestoneId: number) => void;
  hideTeamDetails?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>("Week");
  const [workstream, setWorkstream] = useState<WorkstreamFilter>("all");
  const [milestoneFilter, setMilestoneFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);

  const milestones = useMemo(
    () => tasks.filter((row) => row.entity_type === "milestone"),
    [tasks],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matchingMilestones = new Set<number>();
    if (query) {
      for (const row of tasks) {
        const teamSearch = hideTeamDetails ? "" : row.assignee_names.join(" ");
        const text = `${row.name} ${row.milestone_name} ${teamSearch}`
          .toLocaleLowerCase();
        if (text.includes(query)) matchingMilestones.add(row.milestone_id);
      }
    }
    return tasks.filter((row) => {
      if (workstream !== "all" && row.workstream !== workstream) return false;
      if (milestoneFilter !== "all" && row.milestone_id !== Number(milestoneFilter)) return false;
      if (query && !matchingMilestones.has(row.milestone_id)) return false;
      return true;
    });
  }, [hideTeamDetails, milestoneFilter, search, tasks, workstream]);

  const selectedMilestone = milestones.find((row) => row.milestone_id === selectedMilestoneId) ?? null;
  const selectedTasks = selectedMilestone
    ? tasks.filter(
        (row) => row.entity_type === "task" && row.milestone_id === selectedMilestone.milestone_id,
      )
    : [];
  const selectedDone = selectedTasks.filter((row) => row.status === "done").length;
  const selectedEstimated = selectedTasks.filter((row) => row.is_auto_scheduled).length;

  useEffect(() => {
    if (!chartRef.current || filteredRows.length === 0) return;
    chartRef.current.innerHTML = "";
    // eslint-disable-next-line no-new
    new Gantt(chartRef.current, filteredRows, {
      view_mode: mode,
      date_format: "YYYY-MM-DD",
      readonly: true,
      popup_on: "click",
      bar_height: 25,
      padding: 18,
      on_click: (clicked) => {
        const row = filteredRows.find((candidate) => candidate.id === clicked.id);
        if (row) setSelectedMilestoneId(row.milestone_id);
      },
    });
    const wrappers = chartRef.current.querySelectorAll<SVGGElement>(".bar-wrapper");
    wrappers.forEach((wrapper) => {
      wrapper.addEventListener("click", () => {
        const row = filteredRows.find((candidate) => candidate.id === wrapper.dataset.id);
        if (row) setSelectedMilestoneId(row.milestone_id);
      });
    });
    chartRef.current.addEventListener(
      "mousedown",
      (event) => {
        if ((event.target as Element | null)?.closest(".bar-wrapper")) {
          event.stopPropagation();
        }
      },
      true,
    );
  }, [filteredRows, mode]);

  useEffect(() => {
    if (!chartRef.current || selectedMilestoneId == null) return;
    chartRef.current
      .querySelectorAll(".gantt-selected-row")
      .forEach((row) => row.classList.remove("gantt-selected-row"));
    const wrapper = chartRef.current.querySelector(
      `[data-id="milestone-${selectedMilestoneId}"]`,
    );
    wrapper?.classList.add("gantt-selected-row");
  }, [filteredRows, mode, selectedMilestoneId]);

  function focusMilestone(milestoneId: number) {
    setSelectedMilestoneId(milestoneId);
    setMilestoneFilter(String(milestoneId));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold text-fg">Milestone schedule</h2>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              Milestones are parent bars; their tasks are grouped directly underneath.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-raised/40 p-1">
            {MODES.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={mode === item ? "default" : "ghost"}
                onClick={() => setMode(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>

        {tasks.length > 0 && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[minmax(220px,1fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fg-subtle" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={hideTeamDetails ? "Search milestone or task…" : "Search milestone, task, or assignee…"}
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-fg-subtle" />
              <Select
                className="pl-9"
                value={workstream}
                onChange={(event) => {
                  setWorkstream(event.target.value as WorkstreamFilter);
                  setMilestoneFilter("all");
                }}
              >
                <option value="all">All workstreams</option>
                <option value="project">Project delivery</option>
                <option value="operations">Maintenance &amp; operations</option>
              </Select>
            </div>
            <Select value={milestoneFilter} onChange={(event) => setMilestoneFilter(event.target.value)}>
              <option value="all">All milestones</option>
              {milestones
                .filter((row) => workstream === "all" || row.workstream === workstream)
                .map((row) => (
                  <option key={row.id} value={String(row.milestone_id)}>{row.milestone_name}</option>
                ))}
            </Select>
          </div>
        )}
      </Card>

      {milestones.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {milestones
            .filter((row) => workstream === "all" || row.workstream === workstream)
            .map((milestone) => {
              const Icon = milestone.workstream === "operations" ? Wrench : Rocket;
              const isSelected = selectedMilestoneId === milestone.milestone_id;
              const taskCount = tasks.filter(
                (row) => row.entity_type === "task" && row.milestone_id === milestone.milestone_id,
              ).length;
              return (
                <button
                  key={milestone.id}
                  type="button"
                  onClick={() => focusMilestone(milestone.milestone_id)}
                  className={`min-w-[250px] rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-surface hover:border-accent/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-raised text-accent">
                      <Icon className="h-4 w-4" />
                    </span>
                    <Badge variant={milestone.is_delayed ? "danger" : "neutral"}>
                      {milestone.progress}%
                    </Badge>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-fg">{milestone.milestone_name}</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {taskCount} tasks · {formatDate(milestone.end)}
                  </p>
                </button>
              );
            })}
        </div>
      )}

      {selectedMilestone && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-accent/30 bg-accent-soft/40 p-4">
          <div className="min-w-[240px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-fg">{selectedMilestone.milestone_name}</h3>
              <Badge variant="outline">
                {selectedMilestone.workstream === "operations" ? "Maintenance & operations" : "Project delivery"}
              </Badge>
              {selectedMilestone.is_auto_scheduled && <Badge variant="warning">Estimated schedule</Badge>}
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              {formatDate(selectedMilestone.start)} → {formatDate(selectedMilestone.end)} · {selectedDone}/{selectedTasks.length} tasks done
              {selectedEstimated > 0 ? ` · ${selectedEstimated} task dates estimated` : ""}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={selectedMilestone.progress} className="max-w-xs flex-1" />
              <span className="text-xs font-medium text-fg-muted">{selectedMilestone.progress}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {milestoneFilter !== String(selectedMilestone.milestone_id) && (
              <Button variant="outline" size="sm" onClick={() => setMilestoneFilter(String(selectedMilestone.milestone_id))}>
                Focus timeline
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenMilestone(selectedMilestone.milestone_id)}>
              Open milestone <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="font-semibold text-fg">Timeline</h3>
            <p className="text-xs text-fg-muted">
              Click any bar to inspect its milestone. Dashed bars use estimated dates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-accent" /> Milestone</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-success" /> Done</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-danger" /> Delayed</span>
            <span className="flex items-center gap-1.5"><CircleDashed className="h-4 w-4" /> Estimated</span>
          </div>
        </div>
        {tasks.length === 0 ? (
          <EmptyState
            title="No milestones yet"
            description="Add a milestone to create the project timeline."
          />
        ) : filteredRows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No schedule matches"
              description="Clear the search or change the workstream and milestone filters."
              action={<Button variant="outline" onClick={() => { setSearch(""); setWorkstream("all"); setMilestoneFilter("all"); }}>Clear filters</Button>}
            />
          </div>
        ) : (
          <div className="gantt-workspace overflow-x-auto p-4">
            <div ref={chartRef} className="min-w-[900px]" />
          </div>
        )}
      </Card>
    </div>
  );
}
