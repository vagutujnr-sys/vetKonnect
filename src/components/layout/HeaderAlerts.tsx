import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { countUnreadChats } from "@/services/chatService";
import { getNotifications } from "@/services/notificationService";

/** Chats + notifications icons for owner/vet home headers. */
export function HeaderAlerts() {
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    void Promise.all([getNotifications(), countUnreadChats()])
      .then(([notes, chats]) => {
        setUnreadNotes(notes.filter((n) => !n.read).length);
        setUnreadChats(chats);
      })
      .catch(() => undefined);

    const onFocus = () => {
      void Promise.all([getNotifications(), countUnreadChats()])
        .then(([notes, chats]) => {
          setUnreadNotes(notes.filter((n) => !n.read).length);
          setUnreadChats(chats);
        })
        .catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(onFocus, 20000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-3">
      <Link to="/chats" className="relative" aria-label="Chats">
        <MessageSquare className="size-6 text-foreground" />
        {unreadChats > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadChats > 9 ? "9+" : unreadChats}
          </span>
        ) : null}
      </Link>
      <Link to="/notifications" className="relative" aria-label="Notifications">
        <Bell className="size-6 text-foreground" />
        {unreadNotes > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadNotes > 9 ? "9+" : unreadNotes}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
