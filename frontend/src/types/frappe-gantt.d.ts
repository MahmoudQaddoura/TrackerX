/** Minimal type shim for frappe-gantt 0.6.x (ships no types). */
declare module "frappe-gantt" {
  export interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    custom_class?: string;
    dependencies?: string;
  }

  export interface GanttOptions {
    view_mode?: "Day" | "Week" | "Month" | "Quarter Day" | "Half Day";
    date_format?: string;
    readonly?: boolean;
    popup_on?: "click" | "hover";
    bar_height?: number;
    padding?: number;
  }

  export default class Gantt {
    constructor(
      element: string | HTMLElement | SVGElement,
      tasks: GanttTask[],
      options?: GanttOptions,
    );
    change_view_mode(mode: string): void;
  }
}
