import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Key, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { ADMIN_PIN } from "@/services/userService";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login — VetConnect" },
      { name: "description", content: "Super admin login for VetConnect using a secure 4-digit access code." },
      { property: "og:title", content: "Admin Login — VetConnect" },
      { property: "og:description", content: "Enter the 4-digit admin access code to view the dashboard." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { updateUser } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (code === ADMIN_PIN) {
      updateUser({ isAdmin: true, onboarded: true, modules: ["pets", "community", "marketplace", "rescue", "tips", "farm"] });
      void navigate({ to: "/admin" });
      return;
    }

    setError("Invalid admin code. Please try again.");
  };

  return (
    <MobileScreen className="px-6">
      <div className="flex justify-center pt-10">
        <Logo size="sm" stacked />
      </div>

      <h1 className="mt-10 text-center text-3xl font-extrabold text-primary">Admin access</h1>
      <p className="mt-2 text-center text-[15px] text-muted-foreground">
        Enter your 4-digit admin code to access the VetConnect super admin dashboard.
      </p>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
          <ShieldCheck className="size-6" />
        </span>
        <div className="mt-6">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="Enter 4-digit access code"
            className="mt-4 w-full rounded-2xl border border-border bg-background px-4 py-4 text-center text-2xl font-semibold outline-none"
          />
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>
      </div>

      <Button
        variant="hero"
        size="lg"
        disabled={code.length !== 4}
        onClick={submit}
        className="mt-8 w-full justify-between text-base tracking-wide"
      >
        ENTER ADMIN CODE
        <ArrowRight className="size-5" />
      </Button>
    </MobileScreen>
  );
}
