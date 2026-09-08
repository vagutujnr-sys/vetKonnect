import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { MobileScreen } from "./MobileScreen";

export function AppShell({
  children,
  immersive = false,
}: {
  children: ReactNode;
  /** Full-bleed layouts (maps) — skip bottom nav padding so content fills the viewport. */
  immersive?: boolean;
}) {
  return (
    <MobileScreen withNavPadding={!immersive}>
      {children}
      <BottomNav />
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
