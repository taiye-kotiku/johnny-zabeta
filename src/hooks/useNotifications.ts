import { useEffect, useState } from "react";
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/supabase";
import { useAuthStore } from "@/lib/store";
import { useRealtime } from "./useRealtime";
import type { Notification } from "@/types";

export function useNotifications() {
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!profile) return;
    fetchUserNotifications(profile.id).then(({ data }) => {
      if (data) setNotifications(data as Notification[]);
    });
  }, [profile]);

  useRealtime<{ new: Notification }>(
    `notifications:${profile?.id}`,
    {
      table: "notifications",
      event: "INSERT",
      filter: profile ? `user_id=eq.${profile.id}` : undefined,
      enabled: !!profile,
    },
    (payload) => {
      setNotifications((prev) => [payload.new, ...prev]);
    }
  );

  // Also listen for UPDATE (mark-read syncs across tabs)
  useRealtime<{ new: Notification }>(
    `notifications-update:${profile?.id}`,
    {
      table: "notifications",
      event: "UPDATE",
      filter: profile ? `user_id=eq.${profile.id}` : undefined,
      enabled: !!profile,
    },
    (payload) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === payload.new.id ? payload.new : n))
      );
    }
  );

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await markNotificationRead(id);
  };

  const markAllRead = async () => {
    if (!profile) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead(profile.id);
  };

  return { notifications, unreadCount, markRead, markAllRead };
}
