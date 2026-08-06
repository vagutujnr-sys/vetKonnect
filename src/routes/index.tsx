import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { useApp } from "@/hooks/useApp";
import splashBackground from "@/assets/Splashscreen.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VetConnect Pets — Your pet's health, connected." },
      { name: "description", content: "A premium digital pet healthcare companion for pet owners." },
      { property: "og:title", content: "VetConnect Pets — Your pet's health, connected." },
      { property: "og:description", content: "A premium digital pet healthcare companion for pet owners." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { ready, user } = useApp();

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void navigate({ to: user.onboarded ? "/home" : "/welcome" });
    }, 1800);
    return () => clearTimeout(t);
  }, [ready, user.onboarded, navigate]);

  return (
    <MobileScreen className="relative overflow-hidden">
      <img
        src={splashBackground}
        alt="VetConnect splash background"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="relative flex min-h-[100svh] flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <Logo size="lg" stacked hideSubtitle className="animate-in fade-in zoom-in-95 duration-700" />
      </div>
    </MobileScreen>
  );
}
