import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/hooks/useApp";
import { playNotificationSound } from "@/lib/notificationSound";
import { requestBrowserNotificationPermission } from "@/services/notificationService";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — VetKonnect" },
      { name: "description", content: "Manage notifications and your VetKonnect PIN." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, updateUser } = useApp();
  const notificationsOn = user.notificationsEnabled !== false;

  return (
    <AppShell>
      <header className="flex items-center gap-3 px-5 pb-4 pt-8">
        <Link
          to="/profile"
          className="flex size-10 items-center justify-center rounded-full border border-border"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold">Settings</h1>
          <p className="text-sm text-muted-foreground">Security and preferences</p>
        </div>
      </header>

      <section className="mx-5 card-surface divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <Bell className="size-5 text-primary" />
          <div className="flex-1">
            <p className="font-medium">Notifications</p>
            <p className="text-sm text-muted-foreground">Alerts for likes, comments, security and vet access</p>
          </div>
          <Switch
            checked={notificationsOn}
            onCheckedChange={(checked) => {
              void (async () => {
                await updateUser({ notificationsEnabled: checked });
                if (checked) {
                  playNotificationSound({ force: true });
                  const permission = await requestBrowserNotificationPermission();
                  toast.success(
                    permission === "granted"
                      ? "Notifications enabled (including device alerts)"
                      : "Notifications enabled in-app",
                  );
                } else {
                  toast.success("Notifications paused");
                }
              })();
            }}
          />
        </div>
      </section>

      <section className="mx-5 mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-bold">5-digit PIN</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your mobile number and PIN on any phone or browser. The account is not locked to one device.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
