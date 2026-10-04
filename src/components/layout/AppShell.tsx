import type { ReactNode } from "react";
import { BreedersClubFab } from "@/components/breeders/BreedersClubFab";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { MobileScreen } from "./MobileScreen";

/** Stays pinned to the top of the scrolling screen. */
export const appHeaderClass =
  "sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md";

export function AppShell({
  children,
  immersive = false,
  hideNav = false,
  scrollClassName,
}: {
  children: ReactNode;
  /** Full-bleed layouts (maps and chats) — the page fills the space above the navigation. */
  immersive?: boolean;
  /** Hide the bottom navigation entirely (e.g. chat thread). */
  hideNav?: boolean;
  scrollClassName?: string;
}) {
  const showNav = !hideNav;
  return (
    <MobileScreen className="h-dvh max-h-dvh overflow-hidden">
      <div
        className={cn(
          "relative min-h-0 flex-1",
          immersive || hideNav ? "overflow-hidden" : "overflow-y-auto overscroll-contain",
          scrollClassName,
        )}
      >
        {children}
      </div>
      <div className="relative shrink-0">
        <BreedersClubFab />
        {showNav ? <BottomNav /> : null}
      </div>
    </MobileScreen>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={cn(appHeaderClass, "px-5 pb-3.5 pt-[max(1.15rem,env(safe-area-inset-top))]")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}
