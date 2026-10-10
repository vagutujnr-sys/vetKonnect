import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, ChevronRight, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PinPad } from "@/components/auth/PinPad";
import { AppShell, appHeaderClass } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/hooks/useApp";
import { playNotificationSound } from "@/lib/notificationSound";
import { PIN_LENGTH, verifyPinHash } from "@/lib/pin";
import { requestBrowserNotificationPermission } from "@/services/notificationService";
import { changeAccountPin, IncorrectPinError, readAccountPinHash } from "@/services/userService";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — VetKonnect" },
      { name: "description", content: "Manage notifications and your VetKonnect PIN." },
    ],
  }),
  component: SettingsPage,
});

function ChangePinCard({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"current" | "next" | "confirm">("current");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const hashRef = useRef("");
  const currentPinRef = useRef("");
  const nextPinRef = useRef("");

  const close = () => {
    setOpen(false);
    setReady(false);
    setStep("current");
    setPin("");
    setError(false);
    setSaving(false);
    hashRef.current = "";
    currentPinRef.current = "";
    nextPinRef.current = "";
  };

  const start = () => {
    setOpen(true);
    setReady(false);
    setStep("current");
    setPin("");
    setError(false);
    void readAccountPinHash(accountId)
      .then((hash) => {
        hashRef.current = hash;
        setReady(true);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not open PIN settings.");
        close();
      });
  };

  const onPinChange = (next: string) => {
    setError(false);
    setPin(next);
    if (next.length < PIN_LENGTH || saving || !hashRef.current) return;
    if (step === "current") {
      void verifyPinHash(next, hashRef.current).then((ok) => {
        if (!ok) {
          setError(true);
          setPin("");
          toast.error("Incorrect PIN", { description: "That is not your current PIN." });
          return;
        }
        currentPinRef.current = next;
        setPin("");
        setStep("next");
      });
      return;
    }
    if (step === "next") {
      if (next === currentPinRef.current) {
        setError(true);
        setPin("");
        toast.error("Choose a different PIN from the one you use now.");
        return;
      }
      nextPinRef.current = next;
      setPin("");
      setStep("confirm");
      return;
    }
    if (next !== nextPinRef.current) {
      setError(true);
      setPin("");
      nextPinRef.current = "";
      setStep("next");
      toast.error("Those PINs did not match. Choose it again.");
      return;
    }
    setSaving(true);
    void changeAccountPin({
      accountId,
      currentPin: currentPinRef.current,
      nextPin: next,
      pinHash: hashRef.current,
    })
      .then(() => {
        toast.success("PIN changed", { description: "Use this PIN the next time you sign in." });
        close();
      })
      .catch((err) => {
        setSaving(false);
        setError(true);
        setPin("");
        nextPinRef.current = "";
        setStep("next");
        const message = err instanceof IncorrectPinError ? "That is not your current PIN." : err instanceof Error ? err.message : "Could not change that PIN.";
        toast.error(message);
      });
  };

  const title = step === "current" ? "Enter your current PIN" : step === "next" ? "Choose a new PIN" : "Confirm your new PIN";
  const detail =
    step === "current"
      ? "Enter the 5-digit PIN you use now."
      : step === "next"
        ? "Choose a new 5-digit PIN."
        : "Enter the same 5 digits once more.";

  return (
    <section className="card-surface mt-2 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">5-digit PIN</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your mobile number and PIN on any phone or browser. The account is not locked to one device.
          </p>
        </div>
      </div>
      {open ? (
        <div className="mt-4">
          <h2 className="text-center text-lg font-extrabold text-primary">{ready ? title : "Change PIN"}</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {ready ? (saving ? "Saving your new PIN…" : detail) : "Opening PIN settings…"}
          </p>
          <div className="mt-4">
            <PinPad value={pin} onChange={onPinChange} disabled={!ready || saving} error={error} />
          </div>
          <button
            type="button"
            onClick={close}
            className="mx-auto mt-4 block cursor-pointer text-sm font-medium text-primary underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="mt-4 flex w-full items-center justify-between rounded-md bg-accent px-4 py-3 text-left font-semibold text-primary"
        >
          Change PIN
          <ChevronRight className="size-5" />
        </button>
      )}
    </section>
  );
}

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

      {user.id ? <ChangePinCard accountId={user.id} /> : null}
    </AppShell>
  );
}
