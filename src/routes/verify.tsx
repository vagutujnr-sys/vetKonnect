import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CircleUserRound, Smartphone } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { DEMO_OTP } from "@/services/userService";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify your number — VetKonnect" },
      { name: "description", content: "Confirm your mobile number and tell us your name to finish signing up." },
      { property: "og:title", content: "Verify your number — VetKonnect" },
      { property: "og:description", content: "Verification and profile setup in one step." },
    ],
  }),
  component: Verify,
});

function Verify() {
  const navigate = useNavigate();
  const { user, updateUser } = useApp();
  const [name, setName] = useState(user.fullName);
  const digits = DEMO_OTP.split("");
  const masked = user.phone ? `${user.countryCode} ${user.phone}` : "+263 77X XXX XXX";

  const submit = () => {
    updateUser({ fullName: name.trim() });
    void navigate({ to: "/modules" });
  };

  return (
    <MobileScreen className="px-6">
      <div className="flex justify-center pt-10">
        <Logo size="sm" stacked />
      </div>
      <div className="mt-6">
        <StepIndicator step={2} total={3} />
      </div>

      <h1 className="mt-6 text-center text-3xl font-extrabold text-primary">Almost there!</h1>
      <p className="mt-2 text-center text-[15px] text-muted-foreground">Verify your number and tell us your name.</p>

      <div className="mt-7 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent">
          <Smartphone className="size-5 text-primary" />
        </span>
        <div>
          <p className="font-bold">Verify your phone number</p>
          <p className="text-sm text-primary">{masked}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {digits.map((d, i) => (
          <div
            key={i}
            className="flex h-14 items-center justify-center rounded-xl border border-accent bg-accent/50 text-xl font-bold text-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-accent/60 py-3 text-sm font-medium text-secondary-foreground">
        <BadgeCheck className="size-5 text-primary" />
        Number verified
      </div>
      <button
        onClick={() => navigate({ to: "/register" })}
        className="mx-auto mt-3 block cursor-pointer text-sm font-medium text-primary underline"
      >
        Change number
      </button>

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
          placeholder="Full name"
          className="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground/70"
        />
        {name.trim().length > 2 && <BadgeCheck className="size-6 text-primary" />}
      </div>

      <Button
        variant="hero"
        size="lg"
        disabled={name.trim().length < 2}
        onClick={submit}
        className="my-8 w-full justify-between text-base tracking-wide"
      >
        CONTINUE
        <ArrowRight className="size-5" />
      </Button>
    </MobileScreen>
  );
}
