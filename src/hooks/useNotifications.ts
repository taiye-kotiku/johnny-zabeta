import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store";
import { useRealtime } from "./useRealtime";
import type { Database } from "@/lib/supabase";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function useNotifications() {
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
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

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return { notifications, unreadCount, markRead, markAllRead };
}
