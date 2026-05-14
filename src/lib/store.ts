import { create } from "zustand";
import type { Profile, Session, Task, ActivityStats } from "@/types";

interface AuthState {
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
}

interface SessionState {
  activeSession: Session | null;
  sessionElapsedSeconds: number;
  activityStats: ActivityStats;
  isTracking: boolean;
  screenshotsEnabled: boolean;
  setActiveSession: (session: Session | null) => void;
  incrementElapsed: () => void;
  resetElapsed: () => void;
  updateActivityStats: (stats: Partial<ActivityStats>) => void;
  resetActivityStats: () => void;
  setTracking: (tracking: boolean) => void;
  setScreenshotsEnabled: (enabled: boolean) => void;
}

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface TaskState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  isLoading: true,
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}));

const defaultActivityStats: ActivityStats = {
  keystroke_count: 0,
  mouse_event_count: 0,
  window_focus_seconds: 0,
};

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  sessionElapsedSeconds: 0,
  activityStats: defaultActivityStats,
  isTracking: false,
  screenshotsEnabled: false,
  setActiveSession: (session) => set({ activeSession: session }),
  incrementElapsed: () =>
    set((s) => ({ sessionElapsedSeconds: s.sessionElapsedSeconds + 1 })),
  resetElapsed: () => set({ sessionElapsedSeconds: 0 }),
  updateActivityStats: (stats) =>
    set((s) => ({ activityStats: { ...s.activityStats, ...stats } })),
  resetActivityStats: () => set({ activityStats: defaultActivityStats }),
  setTracking: (isTracking) => set({ isTracking }),
  setScreenshotsEnabled: (screenshotsEnabled) => set({ screenshotsEnabled }),
}));

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));
