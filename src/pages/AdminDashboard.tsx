import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Progress";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { fetchAllWorkers, fetchAllTasks, fetchAllPayouts } from "@/lib/supabase";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Profile, Task, Payout } from "@/types";

export function AdminDashboard() {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [w, t, p] = await Promise.all([
        fetchAllWorkers(),
        fetchAllTasks(),
        fetchAllPayouts(),
      ]);
      if (w.data) setWorkers(w.data);
      if (t.data) setTasks(t.data as Task[]);
      if (p.data) setPayouts(p.data as Payout[]);
      setIsLoading(false);
    }
    load();
  }, []);

  const pendingPayouts = payouts.filter((p) => p.status === "pending");
  const totalPendingValue = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
  const submittedTasks = tasks.filter((t) => t.status === "submitted");
  const onboardedWorkers = workers.filter((w) => w.onboarding_status === "completed").length;
  const onboardedPct = Math.round((onboardedWorkers / Math.max(workers.length, 1)) * 100);

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Admin Dashboard</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Workforce operations overview</p>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Total Workers"
          value={String(workers.length)}
          sub="registered"
        />
        <AdminStatCard
          label="Pending Payouts"
          value={String(pendingPayouts.length)}
          sub={formatCurrency(totalPendingValue)}
          accent="coral"
        />
        <AdminStatCard
          label="Tasks Awaiting Review"
          value={String(submittedTasks.length)}
          sub="submitted"
          accent="lime"
        />
        <AdminStatCard
          label="Onboarded"
          value={`${onboardedPct}%`}
          sub={`${onboardedWorkers} of ${workers.length}`}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            to="/admin/workers"
            className="px-4 py-2 bg-bg-elevated border border-border rounded-xl text-sm font-sans font-medium text-text-primary hover:border-coral/50 hover:text-coral transition-colors"
          >
            Manage Workers
          </Link>
          <Link
            to="/admin/tasks"
            className="px-4 py-2 bg-bg-elevated border border-border rounded-xl text-sm font-sans font-medium text-text-primary hover:border-lime/50 hover:text-lime transition-colors"
          >
            Review Tasks
          </Link>
          <Link
            to="/admin/payouts"
            className="px-4 py-2 bg-bg-elevated border border-border rounded-xl text-sm font-sans font-medium text-text-primary hover:border-coral/50 hover:text-coral transition-colors"
          >
            Process Payouts
          </Link>
        </div>
      </Card>

      {/* Onboarding progress + detail cards */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Completion</CardTitle>
          <span className="text-xs text-text-muted font-grotesk">{onboardedWorkers}/{workers.length}</span>
        </CardHeader>
        <Progress
          value={onboardedWorkers}
          max={Math.max(workers.length, 1)}
          variant="lime"
          size="lg"
          showLabel
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Workers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Workers</CardTitle>
            <Link
              to="/admin/workers"
              className="text-xs text-text-muted hover:text-coral font-sans transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {workers.slice(0, 4).map((w) => (
              <div key={w.id} className="flex items-center gap-3">
                <Avatar name={w.full_name || w.email} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans text-text-primary truncate">
                    {w.full_name || w.email}
                  </p>
                </div>
                <Badge variant={w.onboarding_status === "completed" ? "success" : "warning"}>
                  {w.onboarding_status === "completed" ? "Onboarded" : "Pending"}
                </Badge>
              </div>
            ))}
            {workers.length === 0 && (
              <p className="text-text-disabled font-sans text-sm">No workers yet.</p>
            )}
          </div>
        </Card>

        {/* Pending Payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Payouts</CardTitle>
            <Link
              to="/admin/payouts"
              className="text-xs text-text-muted hover:text-coral font-sans transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {pendingPayouts.slice(0, 4).map((payout) => (
              <div key={payout.id} className="flex items-center justify-between">
                <p className="font-sora font-semibold text-text-primary text-sm">
                  {formatCurrency(payout.amount)}
                </p>
                <p className="text-xs text-text-disabled font-grotesk">
                  {formatRelativeTime(payout.requested_at)}
                </p>
              </div>
            ))}
            {pendingPayouts.length === 0 && (
              <p className="text-text-disabled font-sans text-sm">No pending payouts.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AdminStatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "coral" | "lime";
}) {
  return (
    <Card>
      <p className="text-xs font-grotesk text-text-muted mb-2">{label}</p>
      <p
        className={`font-sora font-bold text-2xl ${
          accent === "coral"
            ? "text-coral"
            : accent === "lime"
            ? "text-lime"
            : "text-text-primary"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-text-disabled font-sans mt-1">{sub}</p>
    </Card>
  );
}
