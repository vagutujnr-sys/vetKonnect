import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BadgeCheck,
  HeartHandshake,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/hooks/useApp";
import { isBreedersClubActive } from "@/lib/account";
import { cn } from "@/lib/utils";

const items = [
  { label: "Breeders Feed", icon: Users, to: "/community" },
  { label: "Find a Sire", icon: HeartHandshake, to: "/pets" },
  { label: "Find a Dam", icon: ShieldCheck, to: "/pets" },
  { label: "Breeding Pets", icon: Sparkles, to: "/pets" },
  { label: "Requests", icon: BadgeCheck, to: "/profile" },
  { label: "Breeder Shop", icon: ShoppingBag, to: "/profile" },
  { label: "My Breeder Profile", icon: UserRound, to: "/profile" },
] as const;

export function BreedersClubFab() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);

  if (!isBreedersClubActive(user)) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-full right-3 z-50">
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {open ? (
          <div className="mb-1 flex w-52 flex-col overflow-hidden border border-border bg-background shadow-[var(--shadow-card)]">
            {items.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-sm font-medium text-foreground last:border-b-0 hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  {label}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Premium"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "premium-float flex size-12 items-center justify-center rounded-full border border-orange-700/20 bg-[linear-gradient(145deg,#ea580c_0%,#fb923c_42%,#fde047_100%)] text-primary shadow-[0_10px_22px_-8px_oklch(0.72_0.16_55/0.65)]",
            open && "ring-2 ring-amber-300/70",
          )}
        >
          <BadgeCheck className="size-7" />
        </button>
      </div>
    </div>
  );
}
