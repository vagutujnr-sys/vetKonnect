import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell, ShieldAlert, Unplug } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { playNotificationSound } from "@/lib/notificationSound";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — VetKonnect" },
      { name: "description", content: "Manage notifications and device security for your VetKonnect account." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, updateUser, unbindDevice } = useApp();
  const navigate = useNavigate();
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
            <p className="text-sm text-muted-foreground">Alerts for likes, comments and security</p>
          </div>
          <Switch
            checked={notificationsOn}
            onCheckedChange={(checked) => {
              void updateUser({ notificationsEnabled: checked });
              if (checked) playNotificationSound({ force: true });
              toast.success(checked ? "Notifications enabled" : "Notifications paused");
            }}
          />
        </div>
      </section>

      <section className="mx-5 mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-bold">Device binding</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account stays locked to this device. Unbind to allow login on another phone or browser.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full gap-2"
          onClick={async () => {
            await unbindDevice();
            toast.success("Account unbound from this device");
            void navigate({ to: "/register" });
          }}
        >
          <Unplug className="size-4" /> Unbind account from this device
        </Button>
      </section>
    </AppShell>
  );
}
