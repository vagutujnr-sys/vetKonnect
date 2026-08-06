import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Home, PawPrint, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/pets", label: "Pets", icon: PawPrint },
  { to: "/community", label: "Community", icon: Users },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
      <div className="pointer-events-auto flex w-full max-w-[398px] items-center justify-between rounded-full bg-primary px-2 py-2 shadow-[var(--shadow-float)]">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary-foreground" : "text-primary-foreground/70 hover:text-primary-foreground",
              )}
            >
              <Icon className={cn("size-6", active ? "stroke-[2.5] text-primary-foreground" : "stroke-[1.5] text-primary-foreground/90")} />
              {active ? label : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
