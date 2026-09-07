import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="size-5 text-[oklch(0.48_0.12_155)]" />,
        error: <XCircle className="size-5 text-[oklch(0.58_0.2_25)]" />,
        warning: <AlertTriangle className="size-5 text-[oklch(0.65_0.15_70)]" />,
        info: <Info className="size-5 text-[oklch(0.52_0.14_250)]" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:border-0 group-[.toaster]:shadow-[var(--shadow-float)]",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "premium-toast-success",
          error: "premium-toast-error",
          warning: "premium-toast-warning",
          info: "premium-toast-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
