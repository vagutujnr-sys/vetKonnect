import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

export function VetFeatureGate({
  verified,
  title,
  children,
}: {
  verified: boolean;
  title: string;
  children: ReactNode;
}) {
  if (verified) return <>{children}</>;

  return (
    <div className="relative h-full min-h-dvh w-full">
      <div className="pointer-events-none absolute inset-0 select-none opacity-40 blur-[1px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-x-0 top-8 z-10 mx-5 rounded-2xl border border-border bg-card/95 p-5 shadow-[var(--shadow-card)] backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent">
            <ShieldAlert className="size-5 text-primary" />
          </span>
          <div>
            <p className="font-extrabold text-foreground">{title} locked</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Your vet account can sign in, but this area opens after VetKonnect admin verifies your practice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
