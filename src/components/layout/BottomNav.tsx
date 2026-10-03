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
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-background/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-sm">
      <div className="pointer-events-auto grid w-full grid-cols-5 items-stretch">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-transparent",
                )}
              >
                <Icon className={cn("size-5", active ? "stroke-[2.5]" : "stroke-[1.5]")} />
              </span>
              <span className={cn(active ? "font-semibold" : "opacity-80")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
