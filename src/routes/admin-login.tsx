import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Key, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { ADMIN_PIN, setAdminSession } from "@/services/userService";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login — VetKonnect" },
      { name: "description", content: "Super admin login for VetKonnect using a secure 4-digit access code." },
      { property: "og:title", content: "Admin Login — VetKonnect" },
      { property: "og:description", content: "Enter the 4-digit admin access code to view the dashboard." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { refreshSession } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (code === ADMIN_PIN) {
      setAdminSession(true);
      await refreshSession();
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
        Enter your 4-digit admin code to access the VetKonnect super admin dashboard.
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
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Key className="size-4" /> Secure admin gate
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>
      </div>

      <Button
        variant="hero"
        size="lg"
        disabled={code.length !== 4}
        onClick={() => void submit()}
        className="mt-8 w-full justify-between text-base tracking-wide"
      >
        ENTER DASHBOARD
        <ArrowRight className="size-5" />
      </Button>
    </MobileScreen>
  );
}
