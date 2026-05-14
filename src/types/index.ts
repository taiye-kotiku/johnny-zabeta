export type UserRole = "worker" | "admin";
export type SessionStatus = "active" | "paused" | "completed";
export type TaskStatus = "open" | "in_progress" | "submitted" | "approved" | "rejected";
export type PayoutStatus = "pending" | "approved" | "released" | "rejected";
export type TrainingStatus = "not_started" | "in_progress" | "completed";
export type NotificationType = "info" | "success" | "warning" | "error" | "payout" | "task" | "session";
export type VerificationStatus = "pending" | "passed" | "failed" | "manual_review";
export type WorkflowEventType =
  | "session_started" | "session_ended" | "session_verified"
  | "activity_packet_received" | "onboarding_started" | "onboarding_completed"
  | "task_assigned" | "task_submitted" | "task_approved" | "task_rejected"
  | "payout_requested" | "payout_approved" | "payout_released" | "payout_rejected"
  | "worker_activated" | "worker_deactivated" | "withdrawal_enabled" | "withdrawal_disabled"
  | "screenshot_uploaded";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  company_id: string | null;
  onboarding_status: TrainingStatus;
  onboarding_completed_at: string | null;
  is_active: boolean;
  withdrawal_enabled: boolean;
  hourly_rate: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingSlide {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  slide_order: number;
  lock_duration_seconds: number;
  is_active: boolean;
}

export interface TrainingProgress {
  id: string;
  user_id: string;
  slide_id: string;
  viewed_at: string;
  duration_viewed_seconds: number;
}

export interface Session {
  id: string;
  user_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  verified: boolean;
  earnings_accrued: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  session_id: string;
  user_id: string;
  keystroke_count: number;
  mouse_event_count: number;
  window_focus_seconds: number;
  recorded_at: string;
  packet_duration_seconds: number;
}

export interface Screenshot {
  id: string;
  session_id: string;
  user_id: string;
  storage_path: string;
  file_size_kb: number | null;
  uploaded_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  status: TaskStatus;
  reward_amount: number;
  deadline: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payout {
  id: string;
  user_id: string;
  amount: number;
  status: PayoutStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  released_at: string | null;
  notes: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WorkflowEvent {
  id: string;
  event_type: WorkflowEventType;
  user_id: string | null;
  actor_id: string | null;
  entity_id: string | null;
  entity_type: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface VerificationQueueItem {
  id: string;
  user_id: string;
  session_id: string | null;
  check_type: string;
  status: VerificationStatus;
  score: number | null;
  details: Record<string, unknown>;
  reviewed_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface SessionAnalytics {
  session_id: string;
  user_id: string;
  total_keystrokes: number;
  total_mouse_events: number;
  total_focus_seconds: number;
  packet_count: number;
  screenshot_count: number;
  computed_at: string;
}

export interface ActivityStats {
  keystroke_count: number;
  mouse_event_count: number;
  window_focus_seconds: number;
}

export interface EdgeFnResult<T = unknown> {
  data: T | null;
  error: string | null;
}
