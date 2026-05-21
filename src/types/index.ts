// =============================================
// TaskFlow — Database Types
// Mirror the Supabase PostgreSQL schema
// =============================================

// --- Enums ---
export type MemberStatus = 'active' | 'pending' | 'suspended';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
export type TaskType = 'general' | 'design' | 'development' | 'testing' | 'review';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// --- Permission keys ---
export type PermissionKey =
  | 'tasks.create' | 'tasks.edit_own' | 'tasks.edit_all' | 'tasks.delete' | 'tasks.assign'
  | 'projects.create' | 'projects.edit' | 'projects.delete'
  | 'team.view' | 'team.invite' | 'team.manage_roles'
  | 'settings.edit' | 'api_keys.manage' | 'labels.manage';

export type Permissions = Record<PermissionKey, boolean>;

// --- Data models ---

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_system_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgRole {
  id: string;
  org_id: string;
  name: string;
  permissions: Permissions;
  is_system: boolean;
  position: number;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role_id: string | null;
  invited_email: string | null;
  invite_token: string | null;
  status: MemberStatus;
  joined_at: string;
  // Joined data
  profile?: Profile;
  role?: OrgRole;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Deliverable {
  label: string;
  url: string;
}

export interface CommentAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Task {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  task_type: TaskType;
  priority: Priority;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_starred: boolean;
  deliverables: Deliverable[];
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  assignee?: Profile;
  creator?: Profile;
  project?: Project;
  comments?: TaskComment[];
  labels?: Label[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  attachments: CommentAttachment[];
  created_at: string;
  // Joined data
  user?: Profile;
}

export interface Label {
  id: string;
  org_id: string;
  name: string;
  color: string;
}

export interface TaskLabel {
  task_id: string;
  label_id: string;
}

export interface ApiKey {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Joined data
  user?: Profile;
}

// --- UI helper types ---

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  tasks: Task[];
}

// --- Display constants ---

export const TASK_STATUS_INFO: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'To Do', color: '#64748b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  in_review: { label: 'In Review', color: '#f59e0b' },
  done: { label: 'Done', color: '#22c55e' },
  blocked: { label: 'Blocked', color: '#ef4444' },
};

export const TASK_TYPE_INFO: Record<TaskType, { label: string; color: string; icon: string }> = {
  general: { label: 'General', color: '#64748b', icon: 'CheckSquare' },
  design: { label: 'Design', color: '#ec4899', icon: 'Palette' },
  development: { label: 'Development', color: '#6366f1', icon: 'Code' },
  testing: { label: 'Testing', color: '#14b8a6', icon: 'FlaskConical' },
  review: { label: 'Review', color: '#f59e0b', icon: 'Eye' },
};

export const PRIORITY_INFO: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#64748b' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#ef4444' },
  urgent: { label: 'Urgent', color: '#dc2626' },
};

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: 'tasks.create', label: 'Create tasks', group: 'Tasks' },
  { key: 'tasks.edit_own', label: 'Edit own tasks', group: 'Tasks' },
  { key: 'tasks.edit_all', label: 'Edit all tasks', group: 'Tasks' },
  { key: 'tasks.delete', label: 'Delete tasks', group: 'Tasks' },
  { key: 'tasks.assign', label: 'Assign tasks', group: 'Tasks' },
  { key: 'projects.create', label: 'Create projects', group: 'Projects' },
  { key: 'projects.edit', label: 'Edit projects', group: 'Projects' },
  { key: 'projects.delete', label: 'Delete projects', group: 'Projects' },
  { key: 'team.view', label: 'View team', group: 'Team' },
  { key: 'team.invite', label: 'Invite members', group: 'Team' },
  { key: 'team.manage_roles', label: 'Manage roles', group: 'Team' },
  { key: 'settings.edit', label: 'Edit settings', group: 'Settings' },
  { key: 'api_keys.manage', label: 'Manage API keys', group: 'Settings' },
  { key: 'labels.manage', label: 'Manage labels', group: 'Settings' },
];

export const DEFAULT_PERMISSIONS: Permissions = {
  'tasks.create': false, 'tasks.edit_own': false, 'tasks.edit_all': false,
  'tasks.delete': false, 'tasks.assign': false,
  'projects.create': false, 'projects.edit': false, 'projects.delete': false,
  'team.view': true, 'team.invite': false, 'team.manage_roles': false,
  'settings.edit': false, 'api_keys.manage': false, 'labels.manage': false,
};
