import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ChannelEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriptionConfig {
  table: string;
  event?: ChannelEvent;
  filter?: string;
  callback: (payload: unknown) => void;
}

class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribe(key: string, config: SubscriptionConfig): () => void {
    this.unsubscribe(key);

    const channel = supabase
      .channel(`zabeta:${key}`)
      .on(
        "postgres_changes" as Parameters<RealtimeChannel["on"]>[0],
        {
          event: config.event ?? "*",
          schema: "public",
          table: config.table,
          ...(config.filter ? { filter: config.filter } : {}),
        },
        config.callback
      )
      .subscribe();

    this.channels.set(key, channel);
    return () => this.unsubscribe(key);
  }

  unsubscribe(key: string) {
    const ch = this.channels.get(key);
    if (ch) {
      supabase.removeChannel(ch);
      this.channels.delete(key);
    }
  }

  unsubscribeAll() {
    for (const key of this.channels.keys()) {
      this.unsubscribe(key);
    }
  }
}

export const realtimeManager = new RealtimeManager();
