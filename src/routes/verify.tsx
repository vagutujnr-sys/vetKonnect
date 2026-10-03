import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleUserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PinPad } from "@/components/auth/PinPad";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { useApp } from "@/hooks/useApp";
import { getAppHomePath } from "@/lib/account";
import { PIN_LENGTH } from "@/lib/pin";
import { setAccountPin, verifyAccountPin } from "@/services/userService";
import { createNotification } from "@/services/notificationService";
import type { AccountType } from "@/types";

type PendingAuth = {
  accountId: string;
  phone: string;
  countryCode: string;
  isNew: boolean;
  hasPin: boolean;
  fullName?: string;
  accountType?: AccountType;
};

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "PIN — VetKonnect" },
      { name: "description", content: "Create or enter your 5-digit VetKonnect PIN." },
    ],
  }),
  component: Verify,
});

function Verify() {
  const navigate = useNavigate();
  const { acceptAuthenticatedUser } = useApp();
  const [pending, setPending] = useState<PendingAuth | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [firstPin, setFirstPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("vetkonnect:pending_auth");
    if (!raw) {
      void navigate({ to: "/register" });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PendingAuth;
      setPending(parsed);
      setName(parsed.fullName ?? "");
    } catch {
      void navigate({ to: "/register" });
    }
  }, [navigate]);

  const returning = Boolean(pending && !pending.isNew && pending.hasPin);
  const needsName = Boolean(pending?.isNew || !pending?.fullName);

  const finish = async (userPin: string) => {
    if (!pending) return;
    setLoading(true);
    setError(false);
    try {
      const user = returning
        ? await verifyAccountPin({ accountId: pending.accountId, pin: userPin })
        : await setAccountPin({
            accountId: pending.accountId,
            pin: userPin,
            fullName: name.trim() || pending.fullName,
          });
      sessionStorage.removeItem("vetkonnect:pending_auth");
      acceptAuthenticatedUser(user);
      try {
        await createNotification({
          accountId: user.id,
          title: returning ? "Signed in" : "PIN saved",
          body: returning
            ? "Welcome back to VetKonnect."
            : user.accountType === "vet"
              ? "Your practice PIN is ready. Patients and Impact unlock after admin verification."
              : "Your 5-digit PIN is ready. Use it whenever you sign in.",
          type: "security",
        });
      } catch {
        // PIN sign-in already succeeded. A missed notice should not undo it.
      }
      toast.success(returning ? "Welcome back" : "PIN created", {
        description: user.accountType === "vet" ? "Opening your vet workspace." : "You can sign in with this PIN on any device.",
      });
      void navigate({ to: getAppHomePath(user) });
    } catch (err) {
      setError(true);
      setPin("");
      if (!returning) {
        setConfirming(false);
        setFirstPin("");
      }
      toast.error(err instanceof Error ? err.message : "Could not check that PIN.");
    } finally {
      setLoading(false);
    }
  };

  const onPinChange = (next: string) => {
    setError(false);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (returning) {
      void finish(next);
      return;
    }
    if (!confirming) {
      if (needsName && name.trim().length < 2) {
        setPin("");
        toast.error("Enter your name before choosing a PIN.");
        return;
      }
      setFirstPin(next);
      setPin("");
      setConfirming(true);
      return;
    }
    if (next !== firstPin) {
      setError(true);
      setPin("");
      setConfirming(false);
      setFirstPin("");
      toast.error("Those PINs did not match. Choose it again.");
      return;
    }
    void finish(next);
  };

  if (!pending) {
    return (
      <MobileScreen className="bg-white px-6">
        <p className="pt-16 text-center text-sm text-muted-foreground">Preparing sign-in…</p>
      </MobileScreen>
    );
  }

  const masked = `${pending.countryCode} ${pending.phone}`;

  return (
    <MobileScreen className="bg-white px-6 pb-6">
      <div className="flex justify-center pt-4">
        <Logo size="sm" />
      </div>

      {returning ? (
        <>
          <h1 className="mt-5 text-center text-2xl font-extrabold text-primary">Welcome back</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">Enter the 5-digit PIN for {masked}.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-center text-2xl font-extrabold text-primary">
            {confirming ? "Confirm your PIN" : "Create your PIN"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {confirming
              ? "Enter the same 5 digits once more."
              : `Choose a 5-digit PIN for ${masked}. You will use it each time you sign in.`}
          </p>
          {needsName && !confirming ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
              <CircleUserRound className="size-5 text-muted-foreground" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Full name"
                className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          ) : null}
        </>
      )}

      <div className="mt-4">
        <PinPad value={pin} onChange={onPinChange} disabled={loading} error={error} />
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/register" })}
        className="mx-auto mt-4 block cursor-pointer text-sm font-medium text-primary underline"
      >
        Change number
      </button>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        {loading ? (returning ? "Checking PIN…" : "Saving PIN…") : confirming ? "Enter the same 5 digits again." : returning ? "Your PIN is checked as soon as the fifth digit is entered." : "The PIN is saved after you confirm it."}
      </p>
    </MobileScreen>
  );
}
