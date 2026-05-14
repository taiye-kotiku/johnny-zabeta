import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDuration } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

interface DailyStats {
  date: string;
  sessions: number;
  earned: number;
  packets: number;
}

interface OnboardingBreakdown {
  name: string;
  value: number;
}

export function Analytics() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [onboardingBreakdown, setOnboardingBreakdown] = useState<OnboardingBreakdown[]>([]);
  const [totals, setTotals] = useState({
    totalSessions: 0,
    totalEarned: 0,
    totalPackets: 0,
    avgSessionMinutes: 0,
    verifiedRate: 0,
  });
  const [recentEvents, setRecentEvents] = useState<{ id: string; event_type: string; created_at: string; payload: Record<string, unknown> }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [sessionsRes, analyticsRes, profilesRes, eventsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("started_at, earnings_accrued, duration_seconds, verified")
          .gte("started_at", thirtyDaysAgo)
          .order("started_at", { ascending: true }),
        supabase
          .from("session_analytics")
          .select("packet_count, total_keystrokes")
          .gte("computed_at", thirtyDaysAgo),
        supabase
          .from("profiles")
          .select("onboarding_status")
          .eq("role", "worker"),
        supabase
          .from("workflow_events")
          .select("id, event_type, created_at, payload")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const sessions = sessionsRes.data ?? [];
      const analytics = analyticsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const events = eventsRes.data ?? [];

      // Daily stats
      const byDay = sessions.reduce((acc, s) => {
        const day = s.started_at.split("T")[0];
        if (!acc[day]) acc[day] = { sessions: 0, earned: 0, packets: 0 };
        acc[day].sessions += 1;
        acc[day].earned += s.earnings_accrued ?? 0;
        return acc;
      }, {} as Record<string, { sessions: number; earned: number; packets: number }>);

      setDailyStats(
        Object.entries(byDay).map(([date, stats]) => ({
          date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          ...stats,
        }))
      );

      // Totals
      const totalEarned = sessions.reduce((s, x) => s + (x.earnings_accrued ?? 0), 0);
      const totalDuration = sessions.reduce((s, x) => s + (x.duration_seconds ?? 0), 0);
      const totalPackets = analytics.reduce((s, a) => s + (a.packet_count ?? 0), 0);
      const verifiedCount = sessions.filter((s) => s.verified).length;

      setTotals({
        totalSessions: sessions.length,
        totalEarned,
        totalPackets,
        avgSessionMinutes: sessions.length > 0 ? Math.round(totalDuration / sessions.length / 60) : 0,
        verifiedRate: sessions.length > 0 ? Math.round((verifiedCount / sessions.length) * 100) : 0,
      });

      // Onboarding breakdown
      const breakdown = profiles.reduce((acc, p) => {
        const key = p.onboarding_status === "completed" ? "Completed" : p.onboarding_status === "in_progress" ? "In Progress" : "Not Started";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setOnboardingBreakdown(
        Object.entries(breakdown).map(([name, value]) => ({ name, value }))
      );

      setRecentEvents(events as typeof recentEvents);
      setIsLoading(false);
    }

    load();
  }, []);

  const PIE_COLORS = ["#A3FF12", "#FF4D6D", "#A78BFA"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Analytics</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Platform performance over the last 30 days</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total Sessions" value={String(totals.totalSessions)} />
        <KPICard label="Total Earned" value={formatCurrency(totals.totalEarned)} accent="coral" />
        <KPICard label="Activity Packets" value={totals.totalPackets.toLocaleString()} />
        <KPICard label="Avg Session" value={`${totals.avgSessionMinutes}m`} />
        <KPICard label="Verification Rate" value={`${totals.verifiedRate}%`} accent="lime" />
      </div>

      {/* Sessions + Earnings chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Daily Sessions</CardTitle>
          </CardHeader>
          {dailyStats.length === 0 ? (
            <p className="text-text-disabled text-sm font-sans">No session data yet.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "Space Grotesk" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "Space Grotesk" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#171923", border: "1px solid #2A2D3E", borderRadius: 8, fontSize: 12, fontFamily: "DM Sans", color: "#F8FAFC" }}
                    formatter={(v: number) => [v, "Sessions"]}
                  />
                  <Bar dataKey="sessions" fill="#A3FF12" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Earnings</CardTitle>
          </CardHeader>
          {dailyStats.length === 0 ? (
            <p className="text-text-disabled text-sm font-sans">No earnings data yet.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="earnAdminGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4D6D" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF4D6D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "Space Grotesk" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "Space Grotesk" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#171923", border: "1px solid #2A2D3E", borderRadius: 8, fontSize: 12, fontFamily: "DM Sans", color: "#F8FAFC" }}
                    formatter={(v: number) => [formatCurrency(v), "Earned"]}
                  />
                  <Area type="monotone" dataKey="earned" stroke="#FF4D6D" strokeWidth={2} fill="url(#earnAdminGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Onboarding pie */}
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Status</CardTitle>
          </CardHeader>
          {onboardingBreakdown.length === 0 ? (
            <p className="text-text-disabled text-sm font-sans">No worker data.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={onboardingBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {onboardingBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "#A1A1AA", fontSize: 11, fontFamily: "Space Grotesk" }}>{value}</span>
                    )}
                  />
                  <Tooltip
                    contentStyle={{ background: "#171923", border: "1px solid #2A2D3E", borderRadius: 8, fontSize: 12, fontFamily: "DM Sans", color: "#F8FAFC" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Event feed */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Event Feed</CardTitle>
            <Badge variant="default">{recentEvents.length} recent</Badge>
          </CardHeader>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-text-disabled text-sm font-sans">No events yet.</p>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-bg-elevated">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                    <span className="text-xs font-grotesk text-text-muted">
                      {event.event_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-xs font-grotesk text-text-disabled">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ label, value, accent }: { label: string; value: string; accent?: "coral" | "lime" }) {
  return (
    <Card>
      <p className="text-xs font-grotesk text-text-muted mb-1">{label}</p>
      <p className={`font-sora font-bold text-xl ${accent === "coral" ? "text-coral" : accent === "lime" ? "text-lime" : "text-text-primary"}`}>
        {value}
      </p>
    </Card>
  );
}

void formatDuration;
