import { Delete } from "lucide-react";
import { useEffect, useRef } from "react";
import { PIN_LENGTH } from "@/lib/pin";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: boolean;
};

export function PinPad({ value, onChange, disabled, error }: Props) {
  const latest = useRef(value);
  useEffect(() => {
    if (value !== "" && latest.current.startsWith(value) && value.length < latest.current.length) return;
    latest.current = value;
  }, [value]);

  const press = (key: string) => {
    if (disabled) return;
    const current = latest.current;
    if (key === "back") {
      const next = current.slice(0, -1);
      latest.current = next;
      onChange(next);
      return;
    }
    if (!key || current.length >= PIN_LENGTH) return;
    const next = `${current}${key}`;
    latest.current = next;
    onChange(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        press("back");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto w-full max-w-[22rem] rounded-[28px] bg-gradient-to-b from-accent to-card px-3 pb-3 pt-4 ring-1 ring-border/80">
      <div className={cn("flex justify-center gap-3", error && "animate-pulse")} aria-hidden>
        {Array.from({ length: PIN_LENGTH }, (_, index) => {
          const filled = index < value.length;
          return (
            <span
              key={index}
              className={cn(
                "size-3.5 rounded-full border-2 transition-all duration-150",
                filled ? "scale-110 border-primary bg-primary" : "border-primary/30 bg-transparent",
                error && "border-destructive bg-destructive",
              )}
            />
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {KEYS.map((key) => {
          if (!key) return <span key="spacer" />;
          const back = key === "back";
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              className={cn(
                "flex h-12 items-center justify-center rounded-2xl text-xl font-semibold text-foreground transition active:scale-95",
                "bg-card shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-border",
                "hover:bg-accent disabled:opacity-50",
                back && "text-primary",
              )}
              aria-label={back ? "Delete" : key}
            >
              {back ? <Delete className="size-6" /> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
