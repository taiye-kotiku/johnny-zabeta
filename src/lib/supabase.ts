import { createClient } from "@supabase/supabase-js";
import type {
  Profile,
  TrainingSlide,
  TrainingProgress,
  Session,
  ActivityLog,
  Screenshot,
  Task,
  Payout,
  Notification,
  WorkflowEvent,
  VerificationQueueItem,
  SessionAnalytics,
  EdgeFnResult,
} from "@/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      training_slides: { Row: TrainingSlide; Insert: Partial<TrainingSlide>; Update: Partial<TrainingSlide> };
      training_progress: { Row: TrainingProgress; Insert: Partial<TrainingProgress>; Update: Partial<TrainingProgress> };
      sessions: { Row: Session; Insert: Partial<Session>; Update: Partial<Session> };
      activity_logs: { Row: ActivityLog; Insert: Partial<ActivityLog>; Update: Partial<ActivityLog> };
      screenshots: { Row: Screenshot; Insert: Partial<Screenshot>; Update: Partial<Screenshot> };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
      payouts: { Row: Payout; Insert: Partial<Payout>; Update: Partial<Payout> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      workflow_events: { Row: WorkflowEvent; Insert: Partial<WorkflowEvent>; Update: Partial<WorkflowEvent> };
      verification_queue: { Row: VerificationQueueItem; Insert: Partial<VerificationQueueItem>; Update: Partial<VerificationQueueItem> };
      session_analytics: { Row: SessionAnalytics; Insert: Partial<SessionAnalytics>; Update: Partial<SessionAnalytics> };
    };
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ── Edge Functions ─────────────────────────────────────────────────────────────

export async function invokeFn<T = unknown>(
  fn: string,
  body: Record<string, unknown>
): Promise<EdgeFnResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(fn, { body });
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export const verifyOnboarding = (userId: string) =>
  invokeFn<{ verified: boolean; slides_total: number; slides_completed: number }>(
    "verify-onboarding",
    { user_id: userId }
  );

export const validateSession = (sessionId: string, userId: string) =>
  invokeFn<{ session_id: string; score: number; status: string; passed: boolean }>(
    "validate-session",
    { session_id: sessionId, user_id: userId }
  );

export const processPayout = (
  payoutId: string,
  action: "approve" | "release" | "reject",
  actorId: string,
  notes?: string
) =>
  invokeFn<{ payout_id: string; new_status: string }>("process-payout", {
    payout_id: payoutId,
    action,
    actor_id: actorId,
    notes,
  });

export const runWorkflowEngine = (
  eventType: string,
  userId: string,
  payload?: Record<string, unknown>
) =>
  invokeFn<{ rules_executed: string[] }>("workflow-engine", {
    event_type: eventType,
    user_id: userId,
    payload,
  });

// ── Auth ──────────────────────────────────────────────────────────────────────

export const signUp = async (email: string, password: string, fullName: string) =>
  supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

export const signIn = async (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

// ── Profile ───────────────────────────────────────────────────────────────────

export const fetchProfile = async (userId: string) =>
  supabase.from("profiles").select("*").eq("id", userId).single();

export const updateProfile = async (userId: string, updates: Partial<Profile>) =>
  supabase.from("profiles").update(updates).eq("id", userId).select().single();

export const fetchAllWorkers = async () =>
  supabase
    .from("profiles")
    .select("*")
    .eq("role", "worker")
    .order("created_at", { ascending: false });

// ── Training ──────────────────────────────────────────────────────────────────

export const fetchTrainingSlides = async () =>
  supabase
    .from("training_slides")
    .select("*")
    .eq("is_active", true)
    .order("slide_order", { ascending: true });

export const markSlideViewed = async (
  userId: string,
  slideId: string,
  durationSeconds: number
) =>
  supabase
    .from("training_progress")
    .upsert({ user_id: userId, slide_id: slideId, duration_viewed_seconds: durationSeconds })
    .select()
    .single();

export const fetchUserTrainingProgress = async (userId: string) =>
  supabase.from("training_progress").select("*").eq("user_id", userId);

// ── Sessions ──────────────────────────────────────────────────────────────────

export const startSession = async (userId: string) =>
  supabase
    .from("sessions")
    .insert({ user_id: userId, status: "active" })
    .select()
    .single();

export const updateSession = async (sessionId: string, updates: Partial<Session>) =>
  supabase.from("sessions").update(updates).eq("id", sessionId).select().single();

export const fetchUserSessions = async (userId: string, limit = 10) =>
  supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

export const fetchActiveSession = async (userId: string) =>
  supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

// ── Activity ──────────────────────────────────────────────────────────────────

export const logActivity = async (log: Partial<ActivityLog>) =>
  supabase.from("activity_logs").insert(log).select().single();

export const fetchSessionActivity = async (sessionId: string) =>
  supabase
    .from("activity_logs")
    .select("*")
    .eq("session_id", sessionId)
    .order("recorded_at", { ascending: false });

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const fetchUserTasks = async (userId: string) =>
  supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false });

export const fetchAllTasks = async () =>
  supabase
    .from("tasks")
    .select("*, profiles!tasks_assigned_to_fkey(full_name, email)")
    .order("created_at", { ascending: false });

export const updateTaskStatus = async (taskId: string, status: string) =>
  supabase.from("tasks").update({ status }).eq("id", taskId).select().single();

export const createTask = async (task: Partial<Task>) =>
  supabase.from("tasks").insert(task).select().single();

// ── Payouts ───────────────────────────────────────────────────────────────────

export const requestPayout = async (userId: string, amount: number) =>
  supabase
    .from("payouts")
    .insert({ user_id: userId, amount, status: "pending" })
    .select()
    .single();

export const fetchUserPayouts = async (userId: string) =>
  supabase
    .from("payouts")
    .select("*")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });

export const fetchAllPayouts = async () =>
  supabase
    .from("payouts")
    .select("*, profiles(full_name, email)")
    .order("requested_at", { ascending: false });

export const updatePayoutStatus = async (
  payoutId: string,
  status: string,
  reviewerId: string,
  notes?: string
) =>
  supabase
    .from("payouts")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      released_at: status === "released" ? new Date().toISOString() : null,
      notes,
    })
    .eq("id", payoutId)
    .select()
    .single();

// ── Notifications ─────────────────────────────────────────────────────────────

export const fetchUserNotifications = async (userId: string, limit = 20) =>
  supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

export const markNotificationRead = async (notificationId: string) =>
  supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);

export const markAllNotificationsRead = async (userId: string) =>
  supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

// ── Workflow Events ───────────────────────────────────────────────────────────

export const fetchRecentEvents = async (limit = 50) =>
  supabase
    .from("workflow_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

export const fetchUserEvents = async (userId: string, limit = 20) =>
  supabase
    .from("workflow_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

// ── Verification Queue ────────────────────────────────────────────────────────

export const fetchVerificationQueue = async () =>
  supabase
    .from("verification_queue")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false });
