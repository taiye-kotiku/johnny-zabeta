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
    };
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

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

export const markSlideViewed = async (userId: string, slideId: string, durationSeconds: number) =>
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
  supabase.from("tasks").select("*").order("created_at", { ascending: false });

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
