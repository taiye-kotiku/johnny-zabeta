import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { useAuthStore, useSessionStore, useTaskStore } from "@/lib/store";
import {
  fetchActiveSession,
  startSession,
  updateSession,
  fetchUserTasks,
  requestPayout,
  validateSession,
  runWorkflowEngine,
} from "@/lib/supabase";
import { invoke } from "@tauri-apps/api/core";
import { useActivitySync } from "@/hooks/useActivitySync";
import { syncQueue } from "@/lib/sync";
import { formatDuration, formatCurrency, formatRelativeTime } from "@/lib/utils";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
import type { Task } from "@/types";

const ACTIVITY_PACKET_SECONDS = 60;
const DAILY_GOAL_SECONDS = 8 * 3600;

export function Dashboard() {
  const { profile } = useAuthStore();
  const {
    activeSession, sessionElapsedSeconds,
    activityStats, isTracking, screenshotsEnabled,
    setActiveSession, resetElapsed,
    setTracking, setScreenshotsEnabled,
  } = useSessionStore();
  const { tasks, setTasks, updateTask } = useTaskStore();

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [sessionToast, setSessionToast] = useState<{ type: "success" | "pending"; msg: string } | null>(null);

  // Centralised activity sync hook — handles timers, listeners, packet flush
  const { packetSeconds, flushNow } = useActivitySync();

  // Flash sync indicator when a packet lands
  useEffect(() => {
    if (packetSeconds === 0 && isTracking) {
      setPulseActive(true);
      const t = setTimeout(() => setPulseActive(false), 1200);
      return () => clearTimeout(t);
    }
  }, [packetSeconds, isTracking]);

  // Load existing active session and tasks
  useEffect(() => {
    if (!profile) return;
    fetchActiveSession(profile.id).then(({ data }) => {
      if (data) { setActiveSession(data); setTracking(true); }
    });
    fetchUserTasks(profile.id).then(({ data }) => {
      if (data) setTasks(data);
    });
  }, [profile, setActiveSession, setTasks, setTracking]);

  const handleStartSession = async () => {
    if (!profile) return;
    setIsStarting(true);
    const { data } = await startSession(profile.id);
    if (data) {
      setActiveSession(data);
      resetElapsed();
      setTracking(true);
      if (isTauri) invoke("start_monitoring", { sessionId: data.id }).catch(() => {});
    }
    setIsStarting(false);
  };

  const handleStopSession = async () => {
    if (!activeSession || !profile) return;
    setIsStopping(true);
    setTracking(false);
    if (isTauri) invoke("stop_monitoring").catch(() => {});

    // Flush any remaining activity packet before closing
    flushNow();
    await syncQueue.flush();

    const sessionId = activeSession.id;

    await updateSession(sessionId, {
      status: "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: sessionElapsedSeconds,
    });

    setActiveSession(null);
    resetElapsed();
    setIsStopping(false);

    // Fire-and-forget: validate session and run workflow engine
    setSessionToast({ type: "pending", msg: "Verifying session…" });
    validateSession(sessionId, profile.id).then(({ data, error }) => {
      if (error || !data) {
        setSessionToast({ type: "pending", msg: "Verification queued." });
      } else if (data.passed) {
        setSessionToast({ type: "success", msg: `Session verified (+earnings credited).` });
        runWorkflowEngine("session_ended", profile.id, {
          session_id: sessionId,
          duration_seconds: sessionElapsedSeconds,
        });
      } else {
        setSessionToast({ type: "pending", msg: `Session flagged for manual review (score: ${data.score}).` });
      }
      setTimeout(() => setSessionToast(null), 5000);
    });
  };

  const handleTaskAction = async (task: Task) => {
    if (task.status === "open") {
      updateTask(task.id, { status: "in_progress" });
    } else if (task.status === "in_progress") {
      updateTask(task.id, { status: "submitted", submitted_at: new Date().toISOString() });
    }
  };

  const handlePayoutRequest = async () => {
    if (!profile || !profile.withdrawal_enabled || profile.pending_balance < 10) return;
    setIsRequestingPayout(true);
    await requestPayout(profile.id, profile.pending_balance);
    setIsRequestingPayout(false);
  };

  const dailyProgress = Math.min(100, (sessionElapsedSeconds / DAILY_GOAL_SECONDS) * 100);
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const completedToday = tasks.filter((t) => t.status === "approved").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Session verification toast */}
      {sessionToast && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-sans animate-fade_in ${
          sessionToast.type === "success"
            ? "bg-lime/10 border-lime/30 text-lime"
            : "bg-lavender/10 border-lavender/30 text-lavender"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${sessionToast.type === "success" ? "bg-lime" : "bg-lavender animate-pulse"}`} />
          {sessionToast.msg}
          <button onClick={() => setSessionToast(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora font-semibold text-2xl text-text-primary">
            {getGreeting()}, {profile?.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-text-muted font-sans text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Session control */}
        {isTracking ? (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-grotesk text-text-muted">Session time</p>
              <p className="font-sora font-semibold text-text-primary tabular-nums">
                {formatDuration(sessionElapsedSeconds)}
              </p>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full bg-lime ${pulseActive ? "animate-pulse_lime" : "animate-pulse"}`} />
            <Button variant="danger" size="md" isLoading={isStopping} onClick={handleStopSession}>
              End Session
            </Button>
          </div>
        ) : (
          <Button variant="lime" size="md" isLoading={isStarting} onClick={handleStartSession}>
            Start Session
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Balance"
          value={formatCurrency(profile?.pending_balance ?? 0)}
          sub="available to withdraw"
          accent="coral"
          animated={isTracking}
        />
        <StatCard
          label="Total Earned"
          value={formatCurrency(profile?.total_earned ?? 0)}
          sub="all time"
          accent="lime"
        />
        <StatCard
          label="Tasks Approved"
          value={String(completedToday)}
          sub="this cycle"
          accent="lavender"
        />
        <StatCard
          label="Today's Activity"
          value={formatDuration(sessionElapsedSeconds)}
          sub={`goal: ${formatDuration(DAILY_GOAL_SECONDS)}`}
          accent="default"
        />
      </div>

      {/* Daily progress + Activity packet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Daily Goal</CardTitle>
            <span className="text-xs font-grotesk text-text-muted">
              {Math.round(dailyProgress)}% complete
            </span>
          </CardHeader>
          <Progress value={dailyProgress} variant="lime" size="lg" animated={isTracking} />
          <p className="text-xs text-text-muted font-sans mt-2">
            {formatDuration(sessionElapsedSeconds)} of {formatDuration(DAILY_GOAL_SECONDS)}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Activity</CardTitle>
            {isTracking && (
              <Badge variant="success">
                <span className="w-1 h-1 rounded-full bg-lime inline-block" />
                Tracking
              </Badge>
            )}
          </CardHeader>
          {isTracking ? (
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-grotesk">
                <span className="text-text-muted">Keystrokes</span>
                <span className="text-text-primary tabular-nums">{activityStats.keystroke_count}</span>
              </div>
              <div className="flex justify-between text-xs font-grotesk">
                <span className="text-text-muted">Mouse events</span>
                <span className="text-text-primary tabular-nums">{activityStats.mouse_event_count}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-xs font-grotesk mb-1">
                  <span className="text-text-muted">Next sync in</span>
                  <span className="text-lime tabular-nums">{ACTIVITY_PACKET_SECONDS - packetSeconds}s</span>
                </div>
                <Progress
                  value={packetSeconds}
                  max={ACTIVITY_PACKET_SECONDS}
                  variant="lime"
                  size="sm"
                  animated
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-sans text-text-muted cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={screenshotsEnabled}
                  onChange={(e) => setScreenshotsEnabled(e.target.checked)}
                  className="rounded border-border accent-coral"
                />
                Enable activity snapshots
              </label>
            </div>
          ) : (
            <p className="text-text-disabled font-sans text-sm">
              Start a session to begin tracking activity.
            </p>
          )}
        </Card>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
          <Badge variant="default">{openTasks.length} open</Badge>
        </CardHeader>
        {openTasks.length === 0 ? (
          <p className="text-text-disabled font-sans text-sm">No open tasks. Check back soon.</p>
        ) : (
          <div className="space-y-2">
            {openTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-sans font-medium text-text-primary truncate">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <TaskStatusBadge status={task.status} />
                    <span className="text-xs text-text-disabled font-grotesk">
                      {formatCurrency(task.reward_amount)} reward
                    </span>
                    {task.deadline && (
                      <span className="text-xs text-text-disabled font-grotesk">
                        due {formatRelativeTime(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                {(task.status === "open" || task.status === "in_progress") && (
                  <Button variant="secondary" size="sm" onClick={() => handleTaskAction(task)}>
                    {task.status === "open" ? "Start" : "Submit"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payout */}
      <Card glow="coral">
        <CardHeader>
          <CardTitle>Withdraw Earnings</CardTitle>
          {!profile?.withdrawal_enabled && (
            <Badge variant="warning">Pending approval</Badge>
          )}
        </CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-sora font-bold text-3xl text-text-primary">
              {formatCurrency(profile?.pending_balance ?? 0)}
            </p>
            <p className="text-text-muted font-sans text-xs mt-1">
              {profile?.withdrawal_enabled
                ? "Withdrawal available. Minimum $10."
                : "Withdrawals are enabled by your admin once your account is verified."}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={
              !profile?.withdrawal_enabled ||
              (profile?.pending_balance ?? 0) < 10 ||
              isRequestingPayout
            }
            isLoading={isRequestingPayout}
            onClick={handlePayoutRequest}
          >
            Request Payout
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  animated,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "coral" | "lime" | "lavender" | "default";
  animated?: boolean;
}) {
  return (
    <Card className={animated ? "border-lime/20" : ""}>
      <p className="text-xs font-grotesk text-text-muted mb-2">{label}</p>
      <p
        className={`font-sora font-bold text-2xl ${
          accent === "coral"
            ? "text-coral"
            : accent === "lime"
            ? "text-lime"
            : accent === "lavender"
            ? "text-lavender"
            : "text-text-primary"
        } ${animated ? "animate-count_up" : ""}`}
      >
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
