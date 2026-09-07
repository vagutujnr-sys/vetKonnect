import type { AppNotification } from "@/types";
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
}): Promise<AppNotification | null> {
  const accountId = input.accountId ?? getSessionAccountId();
  if (!accountId) return null;

  const row = {
    id: crypto.randomUUID(),
    account_id: accountId,
    title: input.title,
    body: input.body,
    type: input.type ?? "system",
    read: false,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("notifications").insert(row).select("*").single();
  if (error) throw error;
  return mapNotification(data as Record<string, unknown>);
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
