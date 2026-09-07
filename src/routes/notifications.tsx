import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BellRing, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import type { AppNotification } from "@/types";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/notificationService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — VetKonnect" },
      { name: "description", content: "Your VetKonnect alerts and security updates." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getNotifications());
    } catch (error) {
      console.error(error);
      toast.error("Could not load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell>
      <header className="flex items-center gap-3 px-5 pb-4 pt-8">
        <Link
          to="/home"
          className="flex size-10 items-center justify-center rounded-full border border-border"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {user.notificationsEnabled === false ? "Notifications are turned off in Settings" : "Stay on top of your pet care"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={async () => {
            await markAllNotificationsRead();
            await load();
          }}
        >
          <CheckCheck className="size-4" /> Mark all
        </Button>
      </header>

      <div className="space-y-3 px-5 pb-8">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && items.length === 0 ? (
          <div className="card-surface p-8 text-center">
            <BellRing className="mx-auto size-8 text-primary" />
            <p className="mt-3 font-bold">You're all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">New likes, comments and security alerts will appear here.</p>
          </div>
        ) : null}
        {items.map((note) => (
          <button
            key={note.id}
            onClick={async () => {
              if (!note.read) {
                await markNotificationRead(note.id);
                setItems((prev) => prev.map((n) => (n.id === note.id ? { ...n, read: true } : n)));
              }
            }}
            className={cn(
              "w-full rounded-2xl border p-4 text-left transition-all",
              note.read ? "border-border bg-card" : "border-primary/20 bg-accent/40 shadow-[var(--shadow-card)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{note.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
              </div>
              {!note.read ? <span className="mt-1 size-2 rounded-full bg-primary" /> : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</p>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
