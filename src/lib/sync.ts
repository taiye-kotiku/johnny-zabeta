/**
 * Background sync queue — buffers activity packets and screenshot uploads
 * so they survive network blips and are retried automatically.
 */

import { logActivity, supabase } from "./supabase";
import type { ActivityLog } from "@/types";

interface QueuedActivityPacket {
  id: string;
  payload: Partial<ActivityLog>;
  attempts: number;
  createdAt: number;
}

interface QueuedScreenshot {
  id: string;
  sessionId: string;
  userId: string;
  dataBase64: string;
  attempts: number;
  createdAt: number;
}

type QueueItem = { type: "activity"; data: QueuedActivityPacket } | { type: "screenshot"; data: QueuedScreenshot };

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 2000;
const FLUSH_INTERVAL_MS = 10_000;

class SyncQueue {
  private queue: QueueItem[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  enqueueActivity(payload: Partial<ActivityLog>) {
    this.queue.push({
      type: "activity",
      data: {
        id: crypto.randomUUID(),
        payload,
        attempts: 0,
        createdAt: Date.now(),
      },
    });
    this.scheduleFlush();
  }

  enqueueScreenshot(sessionId: string, userId: string, dataBase64: string) {
    this.queue.push({
      type: "screenshot",
      data: {
        id: crypto.randomUUID(),
        sessionId,
        userId,
        dataBase64,
        attempts: 0,
        createdAt: Date.now(),
      },
    });
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  async flush() {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;

    const pending = [...this.queue];
    this.queue = [];
    const failed: QueueItem[] = [];

    for (const item of pending) {
      const success = await this.processItem(item);
      if (!success) {
        item.data.attempts += 1;
        if (item.data.attempts < MAX_ATTEMPTS) {
          failed.push(item);
        }
      }
    }

    this.queue = [...failed, ...this.queue];
    if (this.queue.length === 0 && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.isFlushing = false;
  }

  private async processItem(item: QueueItem): Promise<boolean> {
    try {
      if (item.type === "activity") {
        await logActivity(item.data.payload);
        return true;
      }

      if (item.type === "screenshot") {
        const { data: ss } = item;
        const blob = base64ToBlob(ss.dataBase64, "image/jpeg");
        const path = `${ss.userId}/${ss.sessionId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("activity-screenshots")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });

        if (error) throw error;

        await supabase.from("screenshots").insert({
          session_id: ss.sessionId,
          user_id: ss.userId,
          storage_path: path,
          file_size_kb: Math.round(blob.size / 1024),
        });
        return true;
      }

      return false;
    } catch {
      const delay = RETRY_BASE_MS * Math.pow(2, item.data.attempts);
      await sleep(Math.min(delay, 30_000));
      return false;
    }
  }

  get pendingCount() {
    return this.queue.length;
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue = [];
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64.split(",").pop() ?? base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteArr], { type: mimeType });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const syncQueue = new SyncQueue();
