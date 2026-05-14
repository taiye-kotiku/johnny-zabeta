import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Progress";
import { useAuthStore } from "@/lib/store";
import {
  fetchAllWorkers,
  fetchAllTasks,
  fetchAllPayouts,
  updatePayoutStatus,
  updateProfile,
  createTask,
} from "@/lib/supabase";
import { formatCurrency, formatRelativeTime, getInitials } from "@/lib/utils";
import type { Profile, Task, Payout } from "@/types";

type AdminTab = "overview" | "workers" | "tasks" | "payouts";

export function AdminDashboard() {
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", reward_amount: 0, assigned_to: "" });

  useEffect(() => {
    async function load() {
      const [w, t, p] = await Promise.all([
        fetchAllWorkers(),
        fetchAllTasks(),
        fetchAllPayouts(),
      ]);
      if (w.data) setWorkers(w.data);
      if (t.data) setTasks(t.data);
      if (p.data) setPayouts(p.data as Payout[]);
      setIsLoading(false);
    }
    load();
  }, []);

  const handlePayoutAction = async (payoutId: string, action: "approved" | "released" | "rejected") => {
    if (!profile) return;
    await updatePayoutStatus(payoutId, action, profile.id);
    const { data } = await fetchAllPayouts();
    if (data) setPayouts(data as Payout[]);
  };

  const handleToggleWithdrawal = async (worker: Profile) => {
    await updateProfile(worker.id, { withdrawal_enabled: !worker.withdrawal_enabled });
    setWorkers((ws) => ws.map((w) => w.id === worker.id ? { ...w, withdrawal_enabled: !w.withdrawal_enabled } : w));
  };

  const handleCreateTask = async () => {
    if (!profile || !newTask.title) return;
    await createTask({
      ...newTask,
      created_by: profile.id,
      status: "open",
      assigned_to: newTask.assigned_to || undefined,
    });
    const { data } = await fetchAllTasks();
    if (data) setTasks(data);
    setShowNewTask(false);
    setNewTask({ title: "", description: "", reward_amount: 0, assigned_to: "" });
  };

  const pendingPayouts = payouts.filter((p) => p.status === "pending");
  const totalPendingValue = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
  const activeWorkers = workers.filter((w) => w.is_active).length;
  const onboardedWorkers = workers.filter((w) => w.onboarding_status === "completed").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "workers", label: `Workers (${workers.length})` },
    { id: "tasks", label: `Tasks (${tasks.length})` },
    { id: "payouts", label: `Payouts${pendingPayouts.length > 0 ? ` · ${pendingPayouts.length} pending` : ""}` },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Admin Dashboard</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Manage your workforce operations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface border border-border rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-sans transition-all ${
              tab === t.id
                ? "bg-coral text-white font-medium shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCard label="Total Workers" value={String(workers.length)} sub="registered" />
            <AdminStatCard label="Active Now" value={String(activeWorkers)} sub="in session" accent="lime" />
            <AdminStatCard label="Pending Payouts" value={String(pendingPayouts.length)} sub={formatCurrency(totalPendingValue)} accent="coral" />
            <AdminStatCard label="Onboarded" value={`${Math.round((onboardedWorkers / Math.max(workers.length, 1)) * 100)}%`} sub={`${onboardedWorkers} of ${workers.length}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            <Card>
              <CardHeader>
                <CardTitle>Recent Workers</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {workers.slice(0, 4).map((w) => (
                  <div key={w.id} className="flex items-center gap-3">
                    <Avatar name={w.full_name || w.email} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-sans text-text-primary truncate">{w.full_name || w.email}</p>
                    </div>
                    <Badge variant={w.onboarding_status === "completed" ? "success" : "warning"}>
                      {w.onboarding_status === "completed" ? "Onboarded" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Workers */}
      {tab === "workers" && (
        <Card>
          <CardHeader>
            <CardTitle>All Workers</CardTitle>
            <Badge variant="default">{workers.length} total</Badge>
          </CardHeader>
          <div className="space-y-2">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center gap-4 p-3 bg-bg-elevated rounded-lg border border-border/50"
              >
                <Avatar name={worker.full_name || worker.email} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-text-primary">
                    {worker.full_name || "—"}
                  </p>
                  <p className="text-xs text-text-muted font-grotesk">{worker.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={worker.onboarding_status === "completed" ? "success" : "warning"}>
                    {worker.onboarding_status === "completed" ? "Onboarded" : "Training"}
                  </Badge>
                  <div className="text-right">
                    <p className="text-xs font-grotesk text-text-muted">Balance</p>
                    <p className="text-sm font-sora font-semibold text-coral">
                      {formatCurrency(worker.pending_balance)}
                    </p>
                  </div>
                  <Button
                    variant={worker.withdrawal_enabled ? "secondary" : "lime"}
                    size="sm"
                    onClick={() => handleToggleWithdrawal(worker)}
                  >
                    {worker.withdrawal_enabled ? "Lock Payouts" : "Enable Payouts"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tasks */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={() => setShowNewTask(true)}>
              + New Task
            </Button>
          </div>

          {showNewTask && (
            <Card glow="coral">
              <CardHeader>
                <CardTitle>Create Task</CardTitle>
                <button onClick={() => setShowNewTask(false)} className="text-text-muted hover:text-text-primary text-sm">
                  Cancel
                </button>
              </CardHeader>
              <div className="space-y-3">
                <input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-coral/50"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-coral/50 resize-none"
                />
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Reward ($)"
                    value={newTask.reward_amount || ""}
                    onChange={(e) => setNewTask((t) => ({ ...t, reward_amount: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-coral/50"
                  />
                  <select
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask((t) => ({ ...t, assigned_to: e.target.value }))}
                    className="flex-1 bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-coral/50"
                  >
                    <option value="">Assign to (optional)</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.full_name || w.email}</option>
                    ))}
                  </select>
                </div>
                <Button variant="primary" size="md" onClick={handleCreateTask}>
                  Create Task
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border/50"
                >
                  <div>
                    <p className="text-sm font-sans font-medium text-text-primary">{task.title}</p>
                    <div className="flex gap-2 mt-1">
                      <TaskStatusBadge status={task.status} />
                      <span className="text-xs text-text-disabled font-grotesk">
                        {formatCurrency(task.reward_amount)}
                      </span>
                      <span className="text-xs text-text-disabled font-grotesk">
                        {formatRelativeTime(task.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Payouts */}
      {tab === "payouts" && (
        <Card>
          <CardHeader>
            <CardTitle>Payout Requests</CardTitle>
            {pendingPayouts.length > 0 && (
              <Badge variant="warning">{pendingPayouts.length} pending</Badge>
            )}
          </CardHeader>
          {payouts.length === 0 ? (
            <p className="text-text-disabled font-sans text-sm">No payout requests yet.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border/50"
                >
                  <div>
                    <p className="font-sora font-semibold text-text-primary">
                      {formatCurrency(payout.amount)}
                    </p>
                    <div className="flex gap-2 mt-1 items-center">
                      <PayoutStatusBadge status={payout.status} />
                      <span className="text-xs text-text-disabled font-grotesk">
                        requested {formatRelativeTime(payout.requested_at)}
                      </span>
                    </div>
                  </div>
                  {payout.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => handlePayoutAction(payout.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handlePayoutAction(payout.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {payout.status === "approved" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePayoutAction(payout.id, "released")}
                    >
                      Release
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
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
      <p className={`font-sora font-bold text-2xl ${accent === "coral" ? "text-coral" : accent === "lime" ? "text-lime" : "text-text-primary"}`}>
        {value}
      </p>
      <p className="text-xs text-text-disabled font-sans mt-1">{sub}</p>
    </Card>
  );
}

function TaskStatusBadge({ status }: { status: Task["status"] }) {
  const map: Record<Task["status"], { label: string; variant: "default" | "success" | "warning" | "coral" | "lime" | "danger" | "lavender" }> = {
    open: { label: "Open", variant: "default" },
    in_progress: { label: "In Progress", variant: "lavender" },
    submitted: { label: "Submitted", variant: "warning" },
    approved: { label: "Approved", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function PayoutStatusBadge({ status }: { status: Payout["status"] }) {
  const map: Record<Payout["status"], { label: string; variant: "default" | "success" | "warning" | "coral" | "lime" | "danger" | "lavender" }> = {
    pending: { label: "Pending", variant: "warning" },
    approved: { label: "Approved", variant: "lavender" },
    released: { label: "Released", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// avoid unused import warning
void getInitials;
