import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCheck,
  Eye,
  Heart,
  MessageCircle,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
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

type NoteVisual = {
  icon: ComponentType<{ className?: string }>;
  accent: string;
};

function noteVisual(type: string): NoteVisual {
  switch (type) {
    case "like":
      return { icon: Heart, accent: "oklch(0.58 0.2 25)" };
    case "comment":
      return { icon: MessageCircle, accent: "oklch(0.52 0.14 250)" };
    case "view":
      return { icon: Eye, accent: "oklch(0.55 0.08 200)" };
    case "community":
      return { icon: Users, accent: "oklch(0.44 0.121 155.5)" };
    case "security":
      return { icon: ShieldCheck, accent: "oklch(0.48 0.12 155)" };
    case "notice":
      return { icon: Megaphone, accent: "oklch(0.65 0.15 70)" };
    default:
      return { icon: Bell, accent: "oklch(0.44 0.121 155.5)" };
  }
}

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
          <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-[var(--shadow-card)]">
            <BellRing className="mx-auto size-8 text-primary" />
            <p className="mt-3 font-bold">You're all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">New likes, comments and security alerts will appear here.</p>
          </div>
        ) : null}
        {items.map((note) => {
          const visual = noteVisual(note.type);
          const Icon = visual.icon;
          return (
            <button
              key={note.id}
              type="button"
              onClick={async () => {
                if (!note.read) {
                  await markNotificationRead(note.id);
                  setItems((prev) => prev.map((n) => (n.id === note.id ? { ...n, read: true } : n)));
                }
              }}
              className={cn(
                "w-full rounded-2xl bg-white p-4 text-left shadow-[var(--shadow-card)] transition-opacity",
                note.read && "opacity-75",
              )}
              style={{ borderLeft: `4px solid ${visual.accent}` }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{ color: visual.accent, backgroundColor: `color-mix(in oklab, ${visual.accent} 12%, white)` }}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-foreground">{note.title}</p>
                    {!note.read ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: visual.accent }} />
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
