import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { useAuthStore } from "@/lib/store";
import { fetchUserSessions, fetchSessionActivity, supabase } from "@/lib/supabase";
import { formatDuration, formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Session } from "@/types";

interface SessionWithAnalytics extends Session {
  analytics?: {
    total_keystrokes: number;
    total_mouse_events: number;
    packet_count: number;
  };
}

export function Sessions() {
  const { profile } = useAuthStore();
  const [sessions, setSessions] = useState<SessionWithAnalytics[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    async function load() {
      const { data } = await fetchUserSessions(profile!.id, 30);
      if (!data) return;

      // Enrich with analytics
      const enriched = await Promise.all(
        data.map(async (s) => {
          const { data: analytics } = await supabase
            .from("session_analytics")
            .select("total_keystrokes, total_mouse_events, packet_count")
            .eq("session_id", s.id)
            .maybeSingle();
          return { ...s, analytics: analytics ?? undefined };
        })
      );

      setSessions(enriched);
      setIsLoading(false);
    }

    load();
  }, [profile]);

  const handleSelectSession = async (sessionId: string) => {
    setSelected(sessionId);
    const { data } = await fetchSessionActivity(sessionId);
    setActivityLog(data ?? []);
  };

  const selectedSession = sessions.find((s) => s.id === selected);

  const totalTime = sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  const totalEarned = sessions.reduce((sum, s) => sum + s.earnings_accrued, 0);
  const verifiedCount = sessions.filter((s) => s.verified).length;

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
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Sessions</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Your work session history</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Total Time</p>
          <p className="font-sora font-bold text-2xl text-text-primary">{formatDuration(totalTime)}</p>
          <p className="text-xs text-text-disabled font-sans mt-1">{sessions.length} sessions</p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Verified Sessions</p>
          <p className="font-sora font-bold text-2xl text-lime">{verifiedCount}</p>
          <Progress value={verifiedCount} max={Math.max(sessions.length, 1)} variant="lime" size="sm" className="mt-2" />
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Total Earned</p>
          <p className="font-sora font-bold text-2xl text-coral">{formatCurrency(totalEarned)}</p>
          <p className="text-xs text-text-disabled font-sans mt-1">from sessions</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Session list */}
        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
            <Badge variant="default">{sessions.length} total</Badge>
          </CardHeader>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <p className="text-text-disabled font-sans text-sm">No sessions yet. Start your first session from the dashboard.</p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selected === session.id
                      ? "border-coral/40 bg-coral/5"
                      : "border-border/50 bg-bg-elevated hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <SessionStatusDot status={session.status} />
                        <span className="text-sm font-sans font-medium text-text-primary">
                          {formatRelativeTime(session.started_at)}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs font-grotesk text-text-disabled">
                          {formatDuration(session.duration_seconds ?? 0)}
                        </span>
                        {session.analytics && (
                          <span className="text-xs font-grotesk text-text-disabled">
                            {session.analytics.packet_count} packets
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {session.verified ? (
                        <Badge variant="success">Verified</Badge>
                      ) : session.status === "active" ? (
                        <Badge variant="lavender">Active</Badge>
                      ) : (
                        <Badge variant="warning">Unverified</Badge>
                      )}
                      {session.earnings_accrued > 0 && (
                        <p className="text-xs font-grotesk text-coral mt-1">
                          +{formatCurrency(session.earnings_accrued)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Session detail */}
        <Card>
          <CardHeader>
            <CardTitle>Session Detail</CardTitle>
          </CardHeader>
          {!selected || !selectedSession ? (
            <p className="text-text-disabled font-sans text-sm">
              Select a session to view its activity log.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="Duration" value={formatDuration(selectedSession.duration_seconds ?? 0)} />
                <DetailItem label="Status" value={selectedSession.verified ? "Verified" : "Unverified"} accent={selectedSession.verified ? "lime" : "coral"} />
                {selectedSession.analytics && (
                  <>
                    <DetailItem label="Keystrokes" value={selectedSession.analytics.total_keystrokes.toLocaleString()} />
                    <DetailItem label="Mouse Events" value={selectedSession.analytics.total_mouse_events.toLocaleString()} />
                    <DetailItem label="Packets Sent" value={String(selectedSession.analytics.packet_count)} />
                  </>
                )}
                <DetailItem label="Earned" value={formatCurrency(selectedSession.earnings_accrued)} accent="coral" />
              </div>

              <div>
                <p className="text-xs font-grotesk text-text-muted mb-2">Activity Packets</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(activityLog as Array<{id: string; recorded_at: string; keystroke_count: number; mouse_event_count: number; window_focus_seconds: number}>).map((log) => (
                    <div
                      key={log.id}
                      className="flex justify-between items-center py-1.5 px-2 rounded bg-bg-elevated text-xs font-grotesk"
                    >
                      <span className="text-text-disabled">
                        {new Date(log.recorded_at).toLocaleTimeString()}
                      </span>
                      <div className="flex gap-3">
                        <span className="text-text-muted">{log.keystroke_count} keys</span>
                        <span className="text-text-muted">{log.mouse_event_count} mouse</span>
                        <span className="text-lime">{log.window_focus_seconds}s focus</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SessionStatusDot({ status }: { status: Session["status"] }) {
  return (
    <span
      className={`w-2 h-2 rounded-full inline-block ${
        status === "active" ? "bg-lime animate-pulse" : status === "completed" ? "bg-text-disabled" : "bg-yellow-400"
      }`}
    />
  );
}

function DetailItem({ label, value, accent }: { label: string; value: string; accent?: "coral" | "lime" }) {
  return (
    <div className="bg-bg-elevated rounded-lg p-3">
      <p className="text-xs font-grotesk text-text-muted">{label}</p>
      <p className={`font-sora font-semibold text-base mt-0.5 ${accent === "coral" ? "text-coral" : accent === "lime" ? "text-lime" : "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}
