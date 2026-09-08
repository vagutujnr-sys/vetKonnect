import { useEffect, useRef } from "react";
import { useApp } from "@/hooks/useApp";
import { playNotificationSound } from "@/lib/notificationSound";
import { getNotifications } from "@/services/notificationService";

/**
 * Polls for newly arrived unread notifications and plays the app sound.
 * Skips the initial snapshot so opening the app doesn't chime for old items.
 */
export function NotificationSoundWatcher() {
  const { ready, user } = useApp();
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready || !user.id || user.id === "admin-session") return;
    if (user.notificationsEnabled === false) return;

    let cancelled = false;

    const poll = async (announce: boolean) => {
      try {
        const notes = await getNotifications();
        if (cancelled) return;

        const unread = notes.filter((note) => !note.read);
        const known = knownIdsRef.current;

        if (!known) {
          knownIdsRef.current = new Set(unread.map((note) => note.id));
          return;
        }

        let played = false;
        for (const note of unread) {
          if (!known.has(note.id)) {
            known.add(note.id);
            if (announce && !played) {
              playNotificationSound();
              played = true;
            }
          }
        }

        // Drop ids that are no longer unread so remounts stay accurate.
        for (const id of [...known]) {
          if (!unread.some((note) => note.id === id)) known.delete(id);
        }
      } catch (error) {
        console.error("Notification sound poll failed", error);
      }
    };

    void poll(false);
    const timer = window.setInterval(() => void poll(true), 15000);
    const onFocus = () => void poll(true);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, user.id, user.notificationsEnabled]);

  return null;
}
