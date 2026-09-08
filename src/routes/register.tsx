import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Lock, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { getUser, hasActiveSession, requestAccessCode } from "@/services/userService";

function FlagZimbabwe({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 60"
      className={className}
      role="img"
      aria-label="Zimbabwe flag"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="60" fill="#009739" />
      <rect y="10" width="100" height="10" fill="#f4c430" />
      <rect y="20" width="100" height="10" fill="#ef3340" />
      <rect y="30" width="100" height="10" fill="#000" />
      <rect y="40" width="100" height="10" fill="#ef3340" />
      <rect y="50" width="100" height="10" fill="#f4c430" />
      <polygon points="0,0 40,30 0,60" fill="#fff" />
      <polygon points="0,0 30,30 0,60" fill="#000" />
      <polygon points="18,30 10,22 12,28 6,24 14,24 8,28 10,34" fill="#ef3340" />
      <polygon points="9,27 12,30 9,33 11,30" fill="#f4c430" />
    </svg>
  );
}

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await hasActiveSession();
    if (!session) return;
    const user = await getUser();
    throw redirect({ to: user.onboarded && user.modules.length ? "/home" : "/modules" });
  },
  head: () => ({
    meta: [
      { title: "Login — VetKonnect" },
      { name: "description", content: "Sign in or create your VetKonnect account with your mobile number." },
      { property: "og:title", content: "Login — VetKonnect" },
      { property: "og:description", content: "Device-bound secure login for VetKonnect." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const { refreshSession } = useApp();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const result = await requestAccessCode(phone, "+263");

      if (result.skipVerify && result.user) {
        await refreshSession();
        toast.success("Welcome back", {
          description: "Signed in on this trusted device.",
        });
        void navigate({
          to: result.user.onboarded && result.user.modules.length ? "/home" : "/modules",
        });
        return;
      }

      sessionStorage.setItem(
        "vetkonnect:pending_auth",
        JSON.stringify({
          accountId: result.accountId,
          otp: result.otp,
          phone: result.phone,
          countryCode: result.countryCode,
          isNew: result.isNew,
          expiresAt: result.expiresAt,
        }),
      );
      toast.success("Unique access code created", {
        description: "Enter the code on the next screen to bind this device.",
      });
      void navigate({ to: "/verify" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileScreen className="px-6 soft-gradient">
      <div className="flex justify-center pt-12">
        <Logo size="md" stacked />
      </div>

      <h1 className="mt-10 text-center text-3xl font-extrabold text-primary">Welcome back</h1>
      <p className="mt-2 text-center text-[15px] text-muted-foreground">
        Enter your mobile number to create an account or sign in. Your account will be bound to this device.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <span className="flex h-6 w-9 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-white">
            <FlagZimbabwe className="h-full w-full" />
          </span>
          <span className="flex-1 font-medium">Zimbabwe (+263)</span>
          <ChevronDown className="size-5 text-primary" />
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <Phone className="size-5 text-primary" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter mobile number"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-accent/60 p-4 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          VetKonnect uses a unique access code each time — no SMS. After login, this account stays locked to this
          device until you unbind it in Settings.
        </p>
      </div>

      <Button
        variant="hero"
        size="lg"
        disabled={phone.trim().length < 6 || loading}
        onClick={() => void submit()}
        className="mt-8 w-full justify-between text-base tracking-wide"
      >
        {loading ? "Checking…" : "CONTINUE"}
        <ArrowRight className="size-5" />
      </Button>

      <div className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          By continuing, you agree to our <span className="text-primary">Terms of Service</span> and{" "}
          <span className="text-primary">Privacy Policy</span>.
        </p>
      </div>
    </MobileScreen>
  );
}
