import { createElement } from "react";
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
    imageUrl: row.image_url ? String(row.image_url) : null,
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

function notificationAvatarNode(title: string, imageUrl?: string | null) {
  if (imageUrl) {
    return createElement("img", {
      src: imageUrl,
      alt: "",
      className: "size-9 rounded-full object-cover ring-2 ring-white",
    });
  }
  const initial = (title.replace(/^Message from\s+/i, "").trim().charAt(0) || "V").toUpperCase();
  return createElement(
    "span",
    {
      className:
        "flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-white",
    },
    initial,
  );
}

/** In-app toast + sound + optional OS notification for a newly arrived alert. */
export function presentIncomingNotification(
  note: Pick<AppNotification, "title" | "body" | "type" | "imageUrl">,
) {
  if (typeof window === "undefined") return;
  if (!notificationsAllowedLocally()) return;

  playNotificationSound();
  toast(note.title, {
    description: note.body,
    duration: 6500,
    icon: notificationAvatarNode(note.title, note.imageUrl),
  });

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(note.title, {
        body: note.body,
        icon: note.imageUrl || "/favicon.ico",
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

async function resolveActorImageUrl(input: {
  imageUrl?: string | null;
  actorAccountId?: string | null;
}): Promise<string | null> {
  if (input.imageUrl) return input.imageUrl;
  if (!input.actorAccountId) return null;
  const { data } = await supabase
    .from("accounts")
    .select("avatar_url")
    .eq("id", input.actorAccountId)
    .maybeSingle();
  return data?.avatar_url ? String(data.avatar_url) : null;
}

export async function createNotification(input: {
  title: string;
  body: string;
  type?: string;
  accountId?: string;
  /** Direct avatar URL for the actor (preferred when already known). */
  imageUrl?: string | null;
  /** Look up avatar_url from this account id when imageUrl is not passed. */
  actorAccountId?: string | null;
  /** Present toast/sound on this device even if the note is for another account (admin testing). */
  presentLocally?: boolean;
}): Promise<AppNotification | null> {
  const accountId = input.accountId ?? getSessionAccountId();
  if (!accountId) {
    console.warn("createNotification skipped: missing accountId");
    return null;
  }

  const imageUrl = await resolveActorImageUrl({
    imageUrl: input.imageUrl,
    actorAccountId: input.actorAccountId,
  });

  const row: Record<string, unknown> = {
    id: crypto.randomUUID(),
    account_id: accountId,
    title: input.title.trim(),
    body: input.body.trim(),
    type: input.type ?? "system",
    read: false,
    created_at: new Date().toISOString(),
    image_url: imageUrl,
  };

  let { data, error } = await supabase.from("notifications").insert(row).select("*").single();

  // Retry without image_url if migration 017 is not applied yet.
  if (error && (String(error.message ?? "").includes("image_url") || error.code === "PGRST204")) {
    const { image_url: _removed, ...withoutImage } = row;
    const retry = await supabase.from("notifications").insert(withoutImage).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("createNotification failed", error);
    throw error;
  }

  const mapped = mapNotification(data as Record<string, unknown>);
  if (!mapped.imageUrl && imageUrl) mapped.imageUrl = imageUrl;
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
  imageUrl?: string | null;
  actorAccountId?: string | null;
}): Promise<AppNotification | null> {
  try {
    return await createNotification({
      accountId: input.accountId,
      title: input.title,
      body: input.body,
      type: input.type ?? "system",
      imageUrl: input.imageUrl,
      actorAccountId: input.actorAccountId,
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
