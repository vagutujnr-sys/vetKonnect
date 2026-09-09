import { LogoMark } from "@/components/brand/Logo";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const ToastLogo = ({ className }: { className?: string }) => (
  <LogoMark className={className ?? "size-4"} />
);

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <ToastLogo className="size-4" />,
        error: <ToastLogo className="size-4" />,
        warning: <ToastLogo className="size-4" />,
        info: <ToastLogo className="size-4" />,
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
          icon: "group-[.toast]:!size-9 group-[.toast]:!mr-1",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
