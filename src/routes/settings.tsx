import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, appHeaderClass } from "@/components/layout/AppShell";
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
  const whatsappOn = user.whatsappOptIn === true;
  const registeredNumber = [user.countryCode, user.phone].filter(Boolean).join(" ");
  const [sandbox, setSandbox] = useState<{ from: string | null; joinMessage: string | null }>({
    from: null,
    joinMessage: null,
  });

  useEffect(() => {
    let alive = true;
    void fetch("/api/whatsapp/opt-in")
      .then((response) => response.json())
      .then((payload: { from?: string | null; joinMessage?: string | null }) => {
        if (!alive) return;
        setSandbox({
          from: payload.from ?? null,
          joinMessage: payload.joinMessage ?? null,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppShell scrollClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header
        className={`${appHeaderClass} flex items-center gap-3 px-5 pb-3.5 pt-[max(1.15rem,env(safe-area-inset-top))]`}
      >
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

      <section className="card-surface divide-y divide-border">
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
                    permission === "granted" ? "Notifications enabled" : "Notifications enabled in the app",
                  );
                } else {
                  toast.success("Notifications paused");
                }
              })();
            }}
          />
        </div>
        <div className="flex items-start gap-3 px-4 py-4">
          <MessageCircle className="mt-0.5 size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">WhatsApp receipts</p>
            <p className="text-sm text-muted-foreground">
              Visit receipts and follow-up times on {registeredNumber || "your registered number"}.
            </p>
            {whatsappOn && sandbox.joinMessage && sandbox.from ? (
              <p className="mt-2 text-sm text-muted-foreground">
                From this number, send “{sandbox.joinMessage}” to {sandbox.from} on WhatsApp once. Twilio delivers after that join.
              </p>
            ) : null}
          </div>
          <Switch
            checked={whatsappOn}
            aria-label="WhatsApp receipts"
            onCheckedChange={(checked) => {
              void updateUser({ whatsappOptIn: checked })
                .then(() => {
                  toast.success(checked ? "WhatsApp receipts on" : "WhatsApp receipts off");
                })
                .catch((error) => {
                  toast.error(error instanceof Error ? error.message : "Could not update WhatsApp receipts.");
                });
            }}
          />
        </div>
      </section>

      <section className="card-surface mt-2 p-5">
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
