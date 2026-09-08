import { toast } from "sonner";
import type { AppNotification } from "@/types";
import { playNotificationSound } from "@/lib/notificationSound";
import { getSessionAccountId } from "./userService";
import { supabase } from "./supabaseClient";

function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    type: String(row.type ?? "system"),
    read: Boolean(row.read),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function notificationsAllowedLocally() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("vetkonnect:session_profile") : null;
    if (!raw) return true;
    const profile = JSON.parse(raw) as { notificationsEnabled?: boolean };
    return profile.notificationsEnabled !== false;
  } catch {
    return true;
  }
}

/** In-app toast + sound + optional OS notification for a newly arrived alert. */
export function presentIncomingNotification(note: Pick<AppNotification, "title" | "body" | "type">) {
  if (typeof window === "undefined") return;
  if (!notificationsAllowedLocally()) return;

  playNotificationSound();
  toast(note.title, {
    description: note.body,
    duration: 6500,
  });

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(note.title, {
        body: note.body,
        icon: "/favicon.ico",
        tag: `vetkonnect-${note.type || "system"}`,
      });
    } catch {
      // Ignore OS notification failures
    }
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function getNotifications(): Promise<AppNotification[]> {
  const accountId = getSessionAccountId();
  if (!accountId) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapNotification(row as Record<string, unknown>));
}

export async function createNotification(input: {
  title: string;
  body: string;
  type?: string;
  accountId?: string;
  /** Present toast/sound on this device even if the note is for another account (admin testing). */
  presentLocally?: boolean;
}): Promise<AppNotification | null> {
  const accountId = input.accountId ?? getSessionAccountId();
  if (!accountId) {
    console.warn("createNotification skipped: missing accountId");
    return null;
  }

  const row = {
    id: crypto.randomUUID(),
    account_id: accountId,
    title: input.title.trim(),
    body: input.body.trim(),
    type: input.type ?? "system",
    read: false,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("notifications").insert(row).select("*").single();
  if (error) {
    console.error("createNotification failed", error);
    throw error;
  }

  const mapped = mapNotification(data as Record<string, unknown>);
  const isForThisDevice = accountId === getSessionAccountId();
  if (isForThisDevice || input.presentLocally) {
    presentIncomingNotification(mapped);
  }

  return mapped;
}

/** Safe notify for admin/system actions — never blocks the primary mutation. */
export async function notifyAccount(input: {
  accountId: string;
  title: string;
  body: string;
  type?: string;
}): Promise<AppNotification | null> {
  try {
    return await createNotification({
      accountId: input.accountId,
      title: input.title,
      body: input.body,
      type: input.type ?? "system",
    });
  } catch (error) {
    console.error("notifyAccount failed", error);
    return null;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const accountId = getSessionAccountId();
  if (!accountId) return;
  const { error } = await supabase.from("notifications").update({ read: true }).eq("account_id", accountId);
  if (error) throw error;
}
