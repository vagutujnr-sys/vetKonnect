import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/Logo";
import { AppShell, appHeaderClass } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { getAppHomePath } from "@/lib/account";
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

function noteAccent(type: string): string {
  switch (type) {
    case "like":
      return "oklch(0.58 0.2 25)";
    case "comment":
      return "oklch(0.52 0.14 250)";
    case "view":
      return "oklch(0.55 0.08 200)";
    case "community":
      return "oklch(0.44 0.121 155.5)";
    case "security":
      return "oklch(0.48 0.12 155)";
    case "notice":
      return "oklch(0.65 0.15 70)";
    case "health":
      return "oklch(0.48 0.12 155)";
    default:
      return "oklch(0.44 0.121 155.5)";
  }
}

function NotificationsPage() {
  const { user } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const homePath = getAppHomePath(user);

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
    <AppShell scrollClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header
        className={`${appHeaderClass} flex items-center gap-3 px-5 pb-3.5 pt-[max(1.15rem,env(safe-area-inset-top))]`}
      >
        <Link
          to={homePath}
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

      <div className="space-y-2 pb-8">
        {loading ? <p className="px-5 text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-md bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <LogoMark className="mx-auto h-8 w-8" />
            <p className="mt-3 font-bold">You're all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">New likes, comments and security alerts will appear here.</p>
          </div>
        ) : null}
        {items.map((note) => {
          const accent = noteAccent(note.type);
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
                "w-full rounded-md bg-card p-3 text-left shadow-[var(--shadow-card)] transition-opacity",
                note.read && "opacity-75",
              )}
            >
              <div className="flex items-start gap-2">
                {note.imageUrl ? (
                  <img
                    src={note.imageUrl}
                    alt=""
                    className="mt-0.5 size-8 shrink-0 rounded-full object-cover ring-2 ring-white"
                    style={{ boxShadow: `0 0 0 1px color-mix(in oklab, ${accent} 25%, transparent)` }}
                  />
                ) : (
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/70 p-1"
                    style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 25%, transparent)` }}
                  >
                    <LogoMark className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{note.title}</p>
                    {!note.read ? (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{note.body}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
