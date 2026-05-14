import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { AdminDashboard } from "@/pages/AdminDashboard";

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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={profile ? <Navigate to={profile.role === "admin" ? "/admin" : "/dashboard"} replace /> : <Login />}
        />

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route element={<RequireOnboarding />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<Dashboard />} />
              <Route path="/sessions" element={<Dashboard />} />
              <Route path="/earnings" element={<Dashboard />} />
              <Route path="/settings" element={<Dashboard />} />
              <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
              <Route path="/admin/*" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            </Route>
          </Route>

          <Route path="/onboarding" element={<Onboarding />} />
        </Route>

        <Route path="*" element={<Navigate to={profile ? (profile.role === "admin" ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────

import { Outlet } from "react-router-dom";
import type { ReactNode } from "react";

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

function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile } = useAuthStore();
  if (profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
