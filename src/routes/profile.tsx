import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  HelpCircle,
  LogOut,
  PawPrint,
  Settings,
  ShieldCheck,
  ShieldPlus,
  SlidersHorizontal,
  Lock,
} from "lucide-react";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — VetConnect Pets" },
      { name: "description", content: "Manage your account, pets, VetSure membership and app preferences." },
      { property: "og:title", content: "Profile — VetConnect Pets" },
      { property: "og:description", content: "Your VetConnect account and settings." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user, pets, joinVetSure, signOut } = useApp();
  const navigate = useNavigate();
  const initials = (user.fullName || "VC")
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rows = [
    { icon: PawPrint, label: "My pets", value: `${pets.length}`, to: "/pets" as const },
    { icon: SlidersHorizontal, label: "Customize modules", value: `${user.modules.length} active`, to: "/modules" as const },
  ];

  const settings = [
    { icon: Bell, label: "Notifications" },
    { icon: Lock, label: "Privacy" },
    { icon: HelpCircle, label: "Help and support" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <AppShell>
      <ScreenHeader title="Profile" />

      <section className="mx-5 card-surface flex items-center gap-4 p-5">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-xl font-extrabold text-primary">
          {initials}
        </span>
        <div>
          <p className="text-lg font-bold">{user.fullName || "VetConnect user"}</p>
          <p className="text-sm text-muted-foreground">
            {user.countryCode} {user.phone || "—"}
          </p>
        </div>
      </section>

      <section className="mx-5 mt-4 rounded-2xl border border-accent bg-accent/40 p-5">
        <div className="flex items-center gap-3">
          {user.vetSureMember ? <ShieldCheck className="size-6 text-primary" /> : <ShieldPlus className="size-6 text-primary" />}
          <div className="flex-1">
            <p className="font-bold text-primary">VetSure membership</p>
            <p className="text-sm text-muted-foreground">
              {user.vetSureMember ? "Active · all pets covered" : "Not a member yet"}
            </p>
          </div>
          {!user.vetSureMember && (
            <Button variant="hero" size="sm" onClick={joinVetSure}>
              Join
            </Button>
          )}
        </div>
      </section>

      <div className="mx-5 mt-4 card-surface divide-y divide-border">
        {rows.map(({ icon: Icon, label, value, to }) => (
          <Link key={label} to={to} className="flex items-center gap-3 px-4 py-4">
            <Icon className="size-5 text-primary" />
            <span className="flex-1 font-medium">{label}</span>
            <span className="text-sm text-muted-foreground">{value}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="mx-5 mt-4 card-surface divide-y divide-border">
        {settings.map(({ icon: Icon, label }) => (
          <button key={label} className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left">
            <Icon className="size-5 text-primary" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="lg"
        className="mx-5 my-6 gap-2 text-destructive"
        onClick={() => {
          signOut();
          void navigate({ to: "/welcome" });
        }}
      >
        <LogOut className="size-4" /> Sign out
      </Button>
    </AppShell>
  );
}
