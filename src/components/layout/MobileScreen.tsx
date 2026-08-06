import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mobile-first canvas: the app is always rendered as a phone-width column. */
export function MobileScreen({
  children,
  className,
  withNavPadding = false,
}: {
  children: ReactNode;
  className?: string;
  withNavPadding?: boolean;
}) {
  return (
    <div className="min-h-dvh w-full bg-surface">
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background",
          withNavPadding && "pb-32",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
