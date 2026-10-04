import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, HeartHandshake, Home, PawPrint, Stethoscope, User, Users } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { cn } from "@/lib/utils";

const ownerItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/pets", label: "Pets", icon: PawPrint },
  { to: "/community", label: "Community", icon: Users },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const vetItems = [
  { to: "/vet", label: "Dashboard", icon: Stethoscope },
  { to: "/impact", label: "Impact", icon: HeartHandshake },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/community", label: "Community", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useApp();
  const items = isVetAccount(user) ? vetItems : ownerItems;

  return (
    <nav className="z-40 w-full shrink-0 border-t border-border/80 bg-background pb-[max(env(safe-area-inset-bottom),0.2rem)]">
      <div className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2.5",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute inset-x-3.5 top-0 h-0.5 rounded-full",
                  active ? "bg-primary" : "bg-transparent",
                )}
                aria-hidden
              />
              <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
              <span
                className={cn(
                  "max-w-full truncate text-[11px] leading-none tracking-tight",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
