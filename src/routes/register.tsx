import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Lock, Phone } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";

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
  head: () => ({
    meta: [
      { title: "Create your VetConnect account" },
      { name: "description", content: "Enter your phone number to create your VetConnect Pets account." },
      { property: "og:title", content: "Create your VetConnect account" },
      { property: "og:description", content: "Register in seconds with your mobile number." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const { updateUser } = useApp();
  const [phone, setPhone] = useState("");

  const submit = () => {
    updateUser({ phone, countryCode: "+263" });
    void navigate({ to: "/verify" });
  };

  return (
    <MobileScreen className="px-6">
      <div className="flex justify-center pt-12">
        <Logo size="md" stacked />
      </div>

      <h1 className="mt-10 text-center text-3xl font-extrabold text-primary">Let's get started</h1>
      <p className="mt-2 text-center text-[15px] text-muted-foreground">
        Enter your phone number to create your VetConnect account.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border">
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
            placeholder="Enter mobile number"
            className="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <Button
        variant="hero"
        size="lg"
        disabled={phone.trim().length < 6}
        onClick={submit}
        className="mt-8 w-full justify-between text-base tracking-wide"
      >
        CONTINUE
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
