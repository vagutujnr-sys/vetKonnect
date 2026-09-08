import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Dog, Home, ShieldCheck, ShoppingCart, Tractor, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { getAppHomePath, isVetAccount } from "@/lib/account";
import { cn } from "@/lib/utils";
import type { ModuleId } from "@/types";

export const Route = createFileRoute("/modules")({
  head: () => ({
    meta: [
      { title: "Customize your VetKonnect" },
      { name: "description", content: "Choose the VetKonnect modules you want to use — pets, community and more." },
      { property: "og:title", content: "Customize your VetKonnect" },
      { property: "og:description", content: "Personalise the app to how you care for your animals." },
    ],
  }),
  component: Modules,
});

export const moduleOptions: { id: ModuleId; title: string; description: string; icon: typeof Dog }[] = [
  { id: "pets", title: "Pets", description: "Manage your pets, health records, vaccinations, and reminders.", icon: Dog },
  { id: "community", title: "Community", description: "Connect with animal lovers, share stories, and learn from others.", icon: Users },
  { id: "marketplace", title: "Marketplace", description: "Discover trusted pet products and animal services.", icon: ShoppingCart },
  { id: "rescue", title: "Rescue & Adoption", description: "Find lost pets, support rescues, and help animals find homes.", icon: Home },
  { id: "farm", title: "Farm / Herd", description: "Manage livestock, herd health and farm-level care for animals.", icon: Tractor },
  { id: "tips", title: "Pet Care Tips", description: "Receive helpful advice about keeping your pets healthy.", icon: BookOpen },
];

function Modules() {
  const navigate = useNavigate();
  const { user, updateUser } = useApp();
  const [selected, setSelected] = useState<ModuleId[]>(user.modules.length ? user.modules : ["pets"]);

  useEffect(() => {
    if (!isVetAccount(user)) return;
    void (async () => {
      if (!user.onboarded) {
        await updateUser({
          modules: user.modules.length ? user.modules : ["community", "tips"],
          onboarded: true,
          practiceName: user.practiceName?.trim() || `${user.fullName}'s Practice`,
        });
      }
      void navigate({ to: "/patients" });
    })();
  }, [navigate, updateUser, user]);

  if (isVetAccount(user)) {
    return (
      <MobileScreen className="px-5">
        <p className="pt-16 text-center text-sm text-muted-foreground">Opening your vet workspace…</p>
      </MobileScreen>
    );
  }

  const toggle = (id: ModuleId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const finish = async () => {
    await updateUser({ modules: selected, onboarded: true });
    void navigate({ to: getAppHomePath({ ...user, modules: selected, onboarded: true }) });
  };

  return (
    <MobileScreen className="px-5">
      <div className="flex justify-center pt-10">
        <Logo size="sm" stacked />
      </div>
      <div className="mt-6">
        <StepIndicator step={3} total={3} />
      </div>

      <h1 className="mt-6 text-center text-[26px] font-extrabold text-primary">Customize your VetKonnect</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Choose what you'd like to use VetKonnect for. You can change these anytime in Settings.
      </p>

      <div className="mt-6 space-y-3">
        {moduleOptions.map(({ id, title, description, icon: Icon }) => {
          const active = selected.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                active ? "border-primary bg-accent/50 shadow-[var(--shadow-card)]" : "border-border bg-card",
              )}
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                <Icon className="size-6 text-primary" />
              </span>
              <span className="flex-1">
                <span className="block font-bold">{title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{description}</span>
              </span>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {active && <Check className="size-4" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" />
        You can update your selections anytime in Settings.
      </div>

      <Button
        variant="hero"
        size="lg"
        onClick={() => void finish()}
        disabled={selected.length === 0}
        className="my-7 w-full justify-between text-[15px] tracking-wide"
      >
        FINISH & START USING VETKONNECT
        <ArrowRight className="size-5" />
      </Button>
    </MobileScreen>
  );
}
