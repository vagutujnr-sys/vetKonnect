import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CircleUserRound, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { getAppHomePath } from "@/lib/account";
import { verifyAccessCode } from "@/services/userService";
import { createNotification } from "@/services/notificationService";
import type { AccountType } from "@/types";

type PendingAuth = {
  accountId: string;
  otp: string;
  phone: string;
  countryCode: string;
  isNew: boolean;
  expiresAt: string;
  accountType?: AccountType;
};

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify access — VetKonnect" },
      { name: "description", content: "Enter your unique VetKonnect access code to bind this device." },
      { property: "og:title", content: "Verify access — VetKonnect" },
      { property: "og:description", content: "Device-bound verification for your account." },
    ],
  }),
  component: Verify,
});

function Verify() {
  const navigate = useNavigate();
  const { refreshSession } = useApp();
  const [pending, setPending] = useState<PendingAuth | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("vetkonnect:pending_auth");
    if (!raw) {
      void navigate({ to: "/register" });
      return;
    }
    try {
      setPending(JSON.parse(raw) as PendingAuth);
    } catch {
      void navigate({ to: "/register" });
    }
  }, [navigate]);

  const masked = useMemo(() => {
    if (!pending) return "+263 …";
    return `${pending.countryCode} ${pending.phone}`;
  }, [pending]);

  const canSubmit = code.length === 6 && (!pending?.isNew || name.trim().length >= 2);

  const submit = async () => {
    if (!pending) return;
    setLoading(true);
    try {
      const user = await verifyAccessCode({
        accountId: pending.accountId,
        code,
        fullName: name.trim() || undefined,
      });
      sessionStorage.removeItem("vetkonnect:pending_auth");
      await refreshSession();
      await createNotification({
        accountId: user.id,
        title: user.accountType === "vet" ? "Vet account secured" : "Device secured",
        body:
          user.accountType === "vet"
            ? "Your practice account is bound to this device. Patients & Impact unlock after admin verification."
            : "This account is now bound to this device.",
        type: "security",
      });
      toast.success("Device bound successfully", {
        description:
          user.accountType === "vet"
            ? "Opening your vet workspace."
            : "Your VetKonnect account is secured on this device.",
      });
      void navigate({ to: getAppHomePath(user) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!pending) {
    return (
      <MobileScreen className="px-6">
        <p className="pt-16 text-center text-sm text-muted-foreground">Preparing verification…</p>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen className="px-6">
      <div className="flex justify-center pt-10">
        <Logo size="sm" stacked />
      </div>
      <div className="mt-6">
        <StepIndicator step={2} total={3} />
      </div>

      <h1 className="mt-6 text-center text-3xl font-extrabold text-primary">Secure this device</h1>
      <p className="mt-2 text-center text-[15px] text-muted-foreground">
        Enter the unique access code generated for this login. No SMS is sent.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent">
          <Smartphone className="size-5 text-primary" />
        </span>
        <div>
          <p className="font-bold">Access code for</p>
          <p className="text-sm text-primary">{masked}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-primary/20 bg-accent/50 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your unique code</p>
        <p className="mt-2 font-mono text-3xl font-extrabold tracking-[0.35em] text-primary">{pending.otp}</p>
        <p className="mt-2 text-xs text-muted-foreground">Valid for 10 minutes · generated only for this attempt</p>
      </div>

      <div className="mt-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter 6-digit code"
          className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-center text-2xl font-semibold tracking-[0.3em] outline-none"
        />
      </div>

      {code.length === 6 && code === pending.otp ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-accent/60 py-3 text-sm font-medium text-secondary-foreground">
          <BadgeCheck className="size-5 text-primary" />
          Code matches
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => navigate({ to: "/register" })}
        className="mx-auto mt-3 block cursor-pointer text-sm font-medium text-primary underline"
      >
        Change number
      </button>

      {pending.isNew ? (
        <>
          <hr className="my-6 border-border" />

          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent">
              <CircleUserRound className="size-5 text-primary" />
            </span>
            <p className="font-bold">What's your name?</p>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border px-4 py-4">
            <CircleUserRound className="size-5 text-muted-foreground" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Full name"
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            />
            {name.trim().length > 2 && <BadgeCheck className="size-6 text-primary" />}
          </div>
        </>
      ) : null}

      <Button
        variant="hero"
        size="lg"
        disabled={!canSubmit || loading}
        onClick={() => void submit()}
        className="my-8 w-full justify-between text-base tracking-wide"
      >
        {loading ? "Binding device…" : "CONTINUE"}
        <ArrowRight className="size-5" />
      </Button>
    </MobileScreen>
  );
}
