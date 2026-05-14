import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore, useAuthStore } from "@/lib/store";
import { syncQueue } from "@/lib/sync";
import { updateSession } from "@/lib/supabase";

const PACKET_DURATION = 60;
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

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

  // Ref for non-render reads inside intervals; state for reactive UI
  const packetSecondsRef = useRef(0);
  const [packetSeconds, setPacketSeconds] = useState(0);
  const sessionElapsedRef = useRef(0);
  const activityStatsRef = useRef(activityStats);
  activityStatsRef.current = activityStats;

  const flushPacket = useCallback(async () => {
    if (!activeSession || !profile) return;

    let keystroke_count = activityStatsRef.current.keystroke_count;
    let mouse_event_count = activityStatsRef.current.mouse_event_count;
    let window_focus_seconds = activityStatsRef.current.window_focus_seconds;

    // In Tauri: authoritative counts come from Rust atomic counters
    if (isTauri) {
      try {
        const native = await invoke<{
          keystroke_count: number;
          mouse_event_count: number;
          focus_seconds: number;
        }>("drain_activity_packet");
        keystroke_count = native.keystroke_count;
        mouse_event_count = native.mouse_event_count;
        window_focus_seconds = native.focus_seconds;
      } catch {
        // Rust drain failed — fall back to DOM-tracked counts
      }
    }

    syncQueue.enqueueActivity({
      session_id: activeSession.id,
      user_id: profile.id,
      keystroke_count,
      mouse_event_count,
      window_focus_seconds,
      packet_duration_seconds: PACKET_DURATION,
      recorded_at: new Date().toISOString(),
    });

    // Capture activity snapshot if user opted in
    if (screenshotsEnabled && isTauri) {
      try {
        const result = await invoke<{
          success: boolean;
          data_base64: string | null;
        }>("capture_screenshot", { enabled: true });
        if (result.success && result.data_base64) {
          syncQueue.enqueueScreenshot(activeSession.id, profile.id, result.data_base64);
        }
      } catch {
        // Screenshot capture failed silently — non-critical
      }
    }

    resetActivityStats();
    packetSecondsRef.current = 0;
    setPacketSeconds(0);
  }, [activeSession, profile, screenshotsEnabled, resetActivityStats]);

  // Main 1-second heartbeat
  useEffect(() => {
    if (!isTracking) return;

    const tick = setInterval(() => {
      incrementElapsed();
      sessionElapsedRef.current += 1;
      packetSecondsRef.current += 1;
      setPacketSeconds(packetSecondsRef.current);

      if (packetSecondsRef.current >= PACKET_DURATION) {
        flushPacket();
      }

      // Heartbeat session duration to DB every 30s
      if (activeSession && sessionElapsedRef.current % 30 === 0) {
        updateSession(activeSession.id, {
          duration_seconds: sessionElapsedRef.current,
        });
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      if (activityStatsRef.current.keystroke_count > 0) {
        flushPacket();
      }
    };
  }, [isTracking, activeSession, flushPacket, incrementElapsed]);

  // DOM event listeners — always run for UI stats display
  useEffect(() => {
    if (!isTracking) return;

    const onKey = () => {
      updateActivityStats({
        keystroke_count: activityStatsRef.current.keystroke_count + 1,
      });
      if (isTauri) invoke("record_keystroke").catch(() => {});
    };

    const onMouse = () => {
      updateActivityStats({
        mouse_event_count: activityStatsRef.current.mouse_event_count + 1,
      });
      if (isTauri) invoke("record_mouse_event").catch(() => {});
    };

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
    packetSeconds,
    pendingSyncItems: syncQueue.pendingCount,
    flushNow: flushPacket,
  };
}
