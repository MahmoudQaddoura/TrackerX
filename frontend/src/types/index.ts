/**
 * types/index.ts
 * Domain types mirroring the backend response schemas. One source of truth for
 * the shapes that flow through the api/, hooks/, and components/ layers.
 */

export type Role = "admin" | "pm" | "developer" | "client";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done";
export type RiskLevel = "on_track" | "at_risk" | "overdue" | "unknown";
export type DelayCause = "Company" | "Client";
export type DocumentCategory = "technical" | "meeting_minutes" | "business";
export type MeetingType = "sprint" | "client";
export type CommentEntity = "task" | "milestone";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  milestone_count: number;
  total_tasks: number;
  done_tasks: number;
  progress_pct: number;
  is_delayed: boolean;
  risk_level: RiskLevel;
}

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  done_tasks: number;
  progress_pct: number;
  is_delayed: boolean;
  risk_level: RiskLevel;
}

export interface Task {
  id: number;
  milestone_id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TaskStatus;
  is_delayed: boolean;
  delay_cause: DelayCause | null;
  delay_comment: string | null;
  est_days: number | null;
  assigned_member_id: number | null;
  assigned_member_name: string | null;
  assigned_team_id: number | null;
  assigned_team_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  risk_level: RiskLevel;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string | null;
  is_active: boolean;
  task_count: number;
  team_id: number | null;
  team_name: string | null;
  user_id: number | null;
  has_login: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: number;
  name: string;
  function: string | null;
  lead_user_id: number | null;
  lead_name: string | null;
  weekly_capacity_days: number | null;
  created_at: string;
  updated_at: string;
  project_ids: number[];
  project_names: string[];
  member_count: number;
  total_tasks: number;
  active_task_est_days: number;
  load_pct: number | null;
}

export interface DocumentMeta {
  id: number;
  project_id: number;
  milestone_id: number | null;
  category: DocumentCategory;
  title: string;
  description: string | null;
  file_name: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: number;
  project_id: number;
  meeting_type: MeetingType;
  title: string;
  meeting_date: string;
  discussion_points: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  entity_type: CommentEntity;
  entity_id: number;
  author_id: number;
  author_name: string;
  author_role: Role;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface GanttTaskDTO {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  custom_class: string;
}

// Analytics
export interface AnalyticsSummary {
  total_projects: number;
  active_projects: number;
  total_tasks: number;
  done_tasks: number;
  progress_pct: number;
  delayed_tasks: number;
}
export interface StatusBreakdownItem {
  status: TaskStatus;
  count: number;
}
export interface ProjectTimelineItem {
  project_id: number;
  name: string;
  progress_pct: number;
  is_delayed: boolean;
}
export interface DelayedTaskItem {
  task_id: number;
  task_title: string;
  project_id: number;
  project_name: string;
  milestone_title: string;
  owner: string | null;
  delay_cause: DelayCause | null;
  delay_comment: string | null;
  end_date: string | null;
}
