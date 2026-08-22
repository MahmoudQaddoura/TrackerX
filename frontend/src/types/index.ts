/**
 * types/index.ts
 * Domain types mirroring the backend response schemas. One source of truth for
 * the shapes that flow through the api/, hooks/, and components/ layers.
 */

export type Role = "admin" | "pm" | "developer" | "client";
export type EmployeeAccountRole = Exclude<Role, "client">;
export type AccessLevel = "read" | "write";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type ProjectType = "actual_project" | "maintenance_support";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done";
export type RiskLevel = "on_track" | "at_risk" | "overdue" | "unknown";
export type MilestoneWorkstream = "project" | "operations";
export type DelayCause = "Company" | "Client";
export type DocumentCategory = "technical" | "meeting_minutes" | "business";
export type MeetingType = "sprint" | "client";
export type CommentEntity = "task" | "milestone";
export type LeaveRequestType = "leave" | "sick_leave" | "absent";
export type LeaveRequestStatus = "pending" | "approved" | "rejected";
export type LeaveDurationUnit = "days" | "hours";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  access_level: AccessLevel;
  is_enabled: boolean;
  is_primary_admin: boolean;
  must_change_password: boolean;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_type: ProjectType;
  parent_project_id: number | null;
  parent_project_name: string | null;
  start_date: string | null;
  end_date: string | null;
  github_repo_url: string | null;
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
  workstream: MilestoneWorkstream;
  sort_order: number;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  done_tasks: number;
  progress_pct: number;
  is_delayed: boolean;
  risk_level: RiskLevel;
}

export interface TaskAssignee {
  id: number;
  name: string;
  role: string | null;
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
  assigned_members: TaskAssignee[];
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
  total_tasks: number;
  done_tasks: number;
  active_est_days: number;
  projects: {
    id: number;
    name: string;
    assignment_source: "admin" | "task" | "admin_and_task";
  }[];
  assigned_project_ids: number[];
  user_id: number | null;
  has_login: boolean;
  login_email: string | null;
  account_role: EmployeeAccountRole | null;
  is_primary_admin: boolean;
  access_level: AccessLevel | null;
  login_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus =
  | "not_recorded"
  | "present"
  | "remote"
  | "leave"
  | "sick_leave"
  | "absent";

export interface AttendanceRecord {
  id: number | null;
  team_member_id: number;
  employee_name: string;
  employee_role: string | null;
  attendance_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
  recorded_by_name: string | null;
  leave_request_id: number | null;
  updated_at: string | null;
}

export interface LeaveRequest {
  id: number;
  team_member_id: number;
  employee_name: string;
  employee_role: string | null;
  request_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  duration_unit: LeaveDurationUnit;
  start_time: string | null;
  end_time: string | null;
  duration_days: number | null;
  duration_hours: number | null;
  reason: string;
  status: LeaveRequestStatus;
  review_note: string | null;
  reviewed_by_name: string | null;
  attendance_autofilled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DelegateTasksPayload {
  to_member_id: number;
}

export interface DelegateTasksOut {
  from_member_id: number;
  from_member_name: string;
  to_member_id: number;
  to_member_name: string;
  tasks_reassigned: number;
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
  entity_type: "milestone" | "task";
  milestone_id: number;
  milestone_name: string;
  workstream: MilestoneWorkstream;
  task_id: number | null;
  status: TaskStatus | null;
  is_delayed: boolean;
  is_auto_scheduled: boolean;
  assignee_names: string[];
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
  milestone_id: number;
  milestone_title: string;
  owner: string | null;
  delay_cause: DelayCause | null;
  delay_comment: string | null;
  end_date: string | null;
  trigger_type: "manual" | "schedule";
  days_overdue: number | null;
}
