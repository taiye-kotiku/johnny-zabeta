import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { useAuthStore, useSessionStore, useTaskStore } from "@/lib/store";
import {
  fetchActiveSession,
  startSession,
  updateSession,
  logActivity,
  fetchUserTasks,
  requestPayout,
} from "@/lib/supabase";
import { formatDuration, formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Task } from "@/types";

const ACTIVITY_PACKET_SECONDS = 60;
const DAILY_GOAL_SECONDS = 8 * 3600;

export function Dashboard() {
  const { profile } = useAuthStore();
  const {
    activeSession, sessionElapsedSeconds,
    activityStats, isTracking, screenshotsEnabled,
    setActiveSession, incrementElapsed, resetElapsed,
    updateActivityStats, resetActivityStats,
    setTracking, setScreenshotsEnabled,
  } = useSessionStore();
  const { tasks, setTasks, updateTask } = useTaskStore();

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [packetSeconds, setPacketSeconds] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const packetRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing active session and tasks
  useEffect(() => {
    if (!profile) return;
    fetchActiveSession(profile.id).then(({ data }) => {
      if (data) setActiveSession(data);
    });
    fetchUserTasks(profile.id).then(({ data }) => {
      if (data) setTasks(data);
    });
  }, [profile, setActiveSession, setTasks]);

  // Session elapsed timer
  useEffect(() => {
    if (!isTracking) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(incrementElapsed, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, incrementElapsed]);

  // Activity packet flusher — sends a log every 60s
  const flushPacket = useCallback(async () => {
    if (!activeSession || !profile) return;
    await logActivity({
      session_id: activeSession.id,
      user_id: profile.id,
      keystroke_count: activityStats.keystroke_count,
      mouse_event_count: activityStats.mouse_event_count,
      window_focus_seconds: activityStats.window_focus_seconds,
      packet_duration_seconds: ACTIVITY_PACKET_SECONDS,
    });
    resetActivityStats();
    setPacketSeconds(0);
    setPulseActive(true);
    setTimeout(() => setPulseActive(false), 1200);
  }, [activeSession, profile, activityStats, resetActivityStats]);

  useEffect(() => {
    if (!isTracking) {
      if (packetRef.current) clearInterval(packetRef.current);
      setPacketSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setPacketSeconds((s) => {
        if (s + 1 >= ACTIVITY_PACKET_SECONDS) {
          flushPacket();
          return 0;
        }
        return s + 1;
      });
    }, 1000);
    packetRef.current = interval;
    return () => clearInterval(interval);
  }, [isTracking, flushPacket]);

  // Keyboard / mouse counters (transparent to user — visible in UI)
  useEffect(() => {
    if (!isTracking) return;
    const onKey = () => updateActivityStats({ keystroke_count: activityStats.keystroke_count + 1 });
    const onMouse = () => updateActivityStats({ mouse_event_count: activityStats.mouse_event_count + 1 });
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [isTracking, activityStats, updateActivityStats]);

  const handleStartSession = async () => {
    if (!profile) return;
    setIsStarting(true);
    const { data } = await startSession(profile.id);
    if (data) {
      setActiveSession(data);
      resetElapsed();
      setTracking(true);
    }
    setIsStarting(false);
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    setIsStopping(true);
    setTracking(false);
    if (activityStats.keystroke_count > 0 || activityStats.mouse_event_count > 0) {
      await flushPacket();
    }
    await updateSession(activeSession.id, {
      status: "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: sessionElapsedSeconds,
    });
    setActiveSession(null);
    resetElapsed();
    setIsStopping(false);
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
