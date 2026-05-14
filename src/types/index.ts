export type UserRole = "worker" | "admin";
export type SessionStatus = "active" | "paused" | "completed";
export type TaskStatus = "open" | "in_progress" | "submitted" | "approved" | "rejected";
export type PayoutStatus = "pending" | "approved" | "released" | "rejected";
export type TrainingStatus = "not_started" | "in_progress" | "completed";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
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

export interface ActivityStats {
  keystroke_count: number;
  mouse_event_count: number;
  window_focus_seconds: number;
}
