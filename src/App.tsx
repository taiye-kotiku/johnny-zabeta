import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import type { ReactNode } from "react";

import { supabase, fetchProfile } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store";

import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { Sessions } from "@/pages/Sessions";
import { Earnings } from "@/pages/Earnings";
import { Settings } from "@/pages/Settings";
import { Tasks } from "@/pages/Tasks";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { Workers } from "@/pages/admin/Workers";
import { Payouts } from "@/pages/admin/Payouts";
import { Analytics } from "@/pages/admin/Analytics";
import { AdminTasks } from "@/pages/admin/Tasks";

export default function App() {
  const { profile, isLoading, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await fetchProfile(session.user.id);
        setProfile(data ?? null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
      } else if (session?.user) {
        const { data } = await fetchProfile(session.user.id);
        setProfile(data ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setProfile, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-sora text-text-muted text-sm">Loading zabeta...</p>
        </div>
      </div>
    );
  }

  const defaultPath = profile
    ? profile.role === "admin"
      ? "/admin"
      : "/dashboard"
    : "/login";

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={profile ? <Navigate to={defaultPath} replace /> : <Login />}
        />

        {/* Protected */}
        <Route element={<RequireAuth />}>
          {/* Onboarding — no shell */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Worker routes — require completed onboarding */}
          <Route element={<RequireOnboarding />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/settings" element={<Settings />} />

              {/* Admin routes */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/workers" element={<Workers />} />
                <Route path="/admin/tasks" element={<AdminTasks />} />
                <Route path="/admin/payouts" element={<Payouts />} />
                <Route path="/admin/analytics" element={<Analytics />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── Guards ────────────────────────────────────────────────────────────────────

function RequireAuth() {
  const { profile } = useAuthStore();
  if (!profile) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireOnboarding() {
  const { profile } = useAuthStore();
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.onboarding_status !== "completed" && profile.role !== "admin") {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}

function RequireAdmin() {
  const { profile } = useAuthStore();
  if (profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
