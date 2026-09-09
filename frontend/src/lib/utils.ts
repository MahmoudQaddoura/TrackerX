/**
 * lib/utils.ts
 * Small shared helpers: the cn() class combiner, date formatting, file sizes,
 * and the single source of truth for status/risk labels and colours (used by
 * badges AND charts so they always agree).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { RiskLevel, TaskStatus } from "@/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Slice any ISO string to the YYYY-MM-DD a date <input> expects. */
export function toInputDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  done: "Done",
};

export const TASK_STATUS_OPTIONS: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
];

/** Chart/marker colour per task status — kept in hex so Recharts + SVG agree. */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#0b5278",
  in_review: "#d97706",
  blocked: "#dc264d",
  done: "#16a34a",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  overdue: "Overdue",
  unknown: "Unknown",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};
