import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { useState } from "react";
import councilLogo from "@/assets/harare-council-logo.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginDvsOfficer } from "@/services/dvsService";

export const Route = createFileRoute("/dvs-login")({
  head: () => ({
    meta: [
      { title: "DVS Login — VetKonnect" },
      { name: "description", content: "Authorised Department of Veterinary Services animal-health dashboard." },
    ],
  }),
  component: DvsLogin,
});

function DvsLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await loginDvsOfficer(email, password);
      void navigate({ to: "/dvs" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f8fafc_45%,_#e2e8f0_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <img
            src={councilLogo}
            alt="Department of Veterinary Services"
            className="h-24 w-auto object-contain opacity-[0.22] sm:h-28"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
            Department of Veterinary Services
          </p>
          <h1 className="mt-2 text-center text-xl font-bold text-slate-900">Animal Health Digital Dashboard</h1>
          <p className="mt-2 text-center text-sm text-slate-600">
            National control room for animal identification, rabies vaccination and official certificates.
          </p>

          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-10"
                  placeholder="officer@dvs.gov.zw"
                />
              </div>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-10"
                  placeholder="••••••••"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                />
              </div>
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <Button
            className="mt-6 w-full justify-between bg-[#123524] text-white hover:bg-[#0d2819]"
            size="lg"
            disabled={busy || !email.trim() || !password}
            onClick={() => void submit()}
          >
            {busy ? "Signing in…" : "Enter dashboard"}
            <ArrowRight className="size-5" />
          </Button>

          <p className="mt-5 text-center text-xs tracking-wide text-slate-500">
            In Association with <span className="font-semibold text-slate-700">VetKonnect</span>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Officers are registered by VetKonnect admins under Admin → DVS.
        </p>
      </div>
    </div>
  );
}
