import { useEffect, useRef } from "react";
import { useApp } from "@/hooks/useApp";
import { getNotifications, presentIncomingNotification } from "@/services/notificationService";
import { supabase } from "@/services/supabaseClient";
import type { AppNotification } from "@/types";

/**
 * Watches for newly arrived unread notifications (realtime + poll fallback)
 * and presents toast / sound / browser alerts.
 */
export function NotificationSoundWatcher() {
  const { ready, user, refreshSession } = useApp();
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready || !user.id || user.id === "admin-session") return;
    if (user.notificationsEnabled === false) return;

    let cancelled = false;
    const accountId = user.id;

    const rememberAndAnnounce = (notes: AppNotification[], announce: boolean) => {
      const unread = notes.filter((note) => !note.read);
      const known = knownIdsRef.current;

      if (!known) {
        knownIdsRef.current = new Set(unread.map((note) => note.id));
        return;
      }

      let presented = false;
      for (const note of unread) {
        if (!known.has(note.id)) {
          known.add(note.id);
          if (announce && !presented) {
            presentIncomingNotification(note);
            presented = true;
            void refreshSession();
          }
        }
      }

      for (const id of [...known]) {
        if (!unread.some((note) => note.id === id)) known.delete(id);
      }
    };

    const poll = async (announce: boolean) => {
      try {
        const notes = await getNotifications();
        if (cancelled) return;
        rememberAndAnnounce(notes, announce);
      } catch (error) {
        console.error("Notification poll failed", error);
      }
    };

    void poll(false);

    const channel = supabase
      .channel(`notifications:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as Record<string, unknown>;
          const note: AppNotification = {
            id: String(row.id),
            accountId: String(row.account_id),
            title: String(row.title ?? ""),
            body: String(row.body ?? ""),
            type: String(row.type ?? "system"),
            read: Boolean(row.read),
            createdAt: String(row.created_at ?? new Date().toISOString()),
            imageUrl: row.image_url ? String(row.image_url) : null,
          };
          const known = knownIdsRef.current ?? new Set<string>();
          knownIdsRef.current = known;
          if (!known.has(note.id)) {
            known.add(note.id);
            presentIncomingNotification(note);
            void refreshSession();
          }
        },
      )
      .subscribe();

    const timer = window.setInterval(() => void poll(true), 8000);
    const onFocus = () => void poll(true);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [ready, refreshSession, user.id, user.notificationsEnabled]);

  return null;
}
