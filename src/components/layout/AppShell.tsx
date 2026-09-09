import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { MobileScreen } from "./MobileScreen";

export function AppShell({
  children,
  immersive = false,
  hideNav = false,
}: {
  children: ReactNode;
  /** Full-bleed layouts (maps) — skip bottom nav padding so content fills the viewport. */
  immersive?: boolean;
  /** Hide the bottom navigation entirely (e.g. chat thread). */
  hideNav?: boolean;
}) {
  const showNav = !hideNav;
  return (
    <MobileScreen
      withNavPadding={showNav && !immersive}
      className={immersive || hideNav ? "relative h-dvh max-h-dvh overflow-hidden" : undefined}
    >
      {children}
      {showNav ? <BottomNav /> : null}
    </MobileScreen>
  );
}

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-8">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
