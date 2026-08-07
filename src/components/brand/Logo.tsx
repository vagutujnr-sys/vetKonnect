import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return null;
}

export function Logo({
  size = "md",
  stacked = false,
  hideSubtitle = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  stacked?: boolean;
  hideSubtitle?: boolean;
  className?: string;
}) {
  const marks = { sm: "h-8", md: "h-12", lg: "h-20" }[size];
  const text = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col gap-2", className)}>
      <LogoMark className={marks} />
      <div className={cn(stacked && "text-center")}>
        <p className={cn("font-display font-extrabold leading-none text-primary", text)}>VetKonnect</p>
        {!hideSubtitle ? (
          <p className="mt-1 text-[0.65em] font-semibold uppercase tracking-[0.35em] text-brand-light">Care</p>
        ) : null}
      </div>
    </div>
  );
}
