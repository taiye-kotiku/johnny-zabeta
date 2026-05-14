import { useEffect, useRef } from "react";
import { realtimeManager } from "@/lib/realtime";

/**
 * Subscribes to a Supabase realtime channel for a given table.
 * Automatically unsubscribes on unmount.
 */
export function useRealtime<T = unknown>(
  key: string,
  options: {
    table: string;
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    filter?: string;
    enabled?: boolean;
  },
  callback: (payload: T) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (options.enabled === false) return;

    return realtimeManager.subscribe(key, {
      table: options.table,
      event: options.event,
      filter: options.filter,
      callback: (payload) => callbackRef.current(payload as T),
    });
  }, [key, options.table, options.event, options.filter, options.enabled]);
}
