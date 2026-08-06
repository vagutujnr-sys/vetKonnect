import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                s < step && "border-2 border-primary text-primary",
                s === step && "bg-primary text-primary-foreground",
                s > step && "bg-muted text-muted-foreground",
              )}
            >
              {s < step ? <Check className="size-4" /> : s}
            </span>
            {i < steps.length - 1 && (
              <span className={cn("h-px w-10", s < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm font-medium text-primary">
        Step {step} of {total}
      </p>
    </div>
  );
}
