import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { useState } from "react";
import councilLogo from "@/assets/harare-council-logo.jpg";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginCouncilOfficial } from "@/services/councilService";

export const Route = createFileRoute("/council-login")({
  head: () => ({
    meta: [
      { title: "Council Login — VetKonnect" },
      { name: "description", content: "Authorised City Council animal-control dashboard access." },
    ],
  }),
  component: CouncilLogin,
});

function CouncilLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await loginCouncilOfficial(email, password);
      void navigate({ to: "/council" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f8fafc_45%,_#e2e8f0_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-4 sm:gap-5">
          <Logo size="sm" stacked />
          <span className="h-14 w-px bg-slate-300/80" aria-hidden />
          <img
            src={councilLogo}
            alt="City of Harare"
            className="h-16 w-auto object-contain opacity-[0.22] sm:h-[4.5rem]"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-center text-sm text-slate-600">
            Field portal on phone (scan, discover, community). Full municipal dashboard on desktop — same login.
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
                  placeholder="official@city.gov"
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
            className="mt-6 w-full justify-between bg-teal-800 text-white hover:bg-teal-900"
            size="lg"
            disabled={busy || !email.trim() || !password}
            onClick={() => void submit()}
          >
            {busy ? "Signing in…" : "Enter dashboard"}
            <ArrowRight className="size-5" />
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Officials are registered by VetKonnect admins under Admin → Council.
        </p>
      </div>
    </div>
  );
}
