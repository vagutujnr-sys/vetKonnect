import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export function LogoMark({ className, invert }: { className?: string; invert?: boolean }) {
  return (
    <img
      src={logo}
      alt="VetKonnect logo"
      className={cn("object-contain", invert && "brightness-0 invert", className)}
    />
  );
}

export function Logo({
  size = "md",
  stacked = false,
  hideSubtitle = false,
  markOnly = false,
  invert = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  stacked?: boolean;
  hideSubtitle?: boolean;
  /** Show only the mark — no “VetKonnect” wordmark. */
  markOnly?: boolean;
  /** Force the mark white (for dark backgrounds). */
  invert?: boolean;
  className?: string;
}) {
  const marks = { sm: "h-8", md: "h-12", lg: "h-20" }[size];
  const text = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" }[size];

  if (markOnly || hideSubtitle) {
    return <LogoMark className={cn(marks, className)} invert={invert} />;
  }

  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col gap-2", className)}>
      <LogoMark className={marks} invert={invert} />
      <div className={cn(stacked && "text-center")}>
        <p
          className={cn(
            "font-display font-extrabold leading-none",
            invert ? "text-white" : "text-primary",
            text,
          )}
        >
          VetKonnect
        </p>
      </div>
    </div>
  );
}
