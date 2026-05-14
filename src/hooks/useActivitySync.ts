import { useEffect, useRef, useCallback } from "react";
import { useSessionStore, useAuthStore } from "@/lib/store";
import { syncQueue } from "@/lib/sync";
import { updateSession } from "@/lib/supabase";

const PACKET_DURATION = 60;

/**
 * Manages the 60-second activity packet cycle and background sync.
 * Runs while a session is active.
 */
export function useActivitySync() {
  const { profile } = useAuthStore();
  const {
    activeSession,
    isTracking,
    activityStats,
    screenshotsEnabled,
    incrementElapsed,
    updateActivityStats,
    resetActivityStats,
  } = useSessionStore();

  const packetSecondsRef = useRef(0);
  const sessionElapsedRef = useRef(0);
  const activityStatsRef = useRef(activityStats);
  activityStatsRef.current = activityStats;

  const flushPacket = useCallback(() => {
    if (!activeSession || !profile) return;
    syncQueue.enqueueActivity({
      session_id: activeSession.id,
      user_id: profile.id,
      keystroke_count: activityStatsRef.current.keystroke_count,
      mouse_event_count: activityStatsRef.current.mouse_event_count,
      window_focus_seconds: activityStatsRef.current.window_focus_seconds,
      packet_duration_seconds: PACKET_DURATION,
      recorded_at: new Date().toISOString(),
    });
    resetActivityStats();
    packetSecondsRef.current = 0;
  }, [activeSession, profile, resetActivityStats]);

  // Main 1-second heartbeat
  useEffect(() => {
    if (!isTracking) return;

    const tick = setInterval(() => {
      incrementElapsed();
      sessionElapsedRef.current += 1;
      packetSecondsRef.current += 1;

      if (packetSecondsRef.current >= PACKET_DURATION) {
        flushPacket();
      }

      // Update session duration in DB every 30s
      if (activeSession && sessionElapsedRef.current % 30 === 0) {
        updateSession(activeSession.id, {
          duration_seconds: sessionElapsedRef.current,
        });
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      // Flush remaining on cleanup
      if (activityStatsRef.current.keystroke_count > 0) {
        flushPacket();
      }
    };
  }, [isTracking, activeSession, flushPacket, incrementElapsed]);

  // Input event listeners — transparent to user (shown in UI)
  useEffect(() => {
    if (!isTracking) return;

    const onKey = () =>
      updateActivityStats({
        keystroke_count: activityStatsRef.current.keystroke_count + 1,
      });

    const onMouse = () =>
      updateActivityStats({
        mouse_event_count: activityStatsRef.current.mouse_event_count + 1,
      });

    let focusInterval: ReturnType<typeof setInterval> | null = null;
    const onFocus = () => {
      focusInterval = setInterval(() => {
        updateActivityStats({
          window_focus_seconds: activityStatsRef.current.window_focus_seconds + 1,
        });
      }, 1000);
    };
    const onBlur = () => {
      if (focusInterval) clearInterval(focusInterval);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    // Start focus tracking if window already focused
    if (document.hasFocus()) onFocus();

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      if (focusInterval) clearInterval(focusInterval);
    };
  }, [isTracking, updateActivityStats]);

  return {
    packetSeconds: packetSecondsRef.current,
    pendingSyncItems: syncQueue.pendingCount,
    flushNow: flushPacket,
  };
}
