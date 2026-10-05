import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { CircleUserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PinPad } from "@/components/auth/PinPad";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { useApp } from "@/hooks/useApp";
import { getAppHomePath } from "@/lib/account";
import { PIN_LENGTH } from "@/lib/pin";
import { warmSignInDestinations } from "@/lib/warmRoutes";
import { beginAccessLookup, IncorrectPinError, setAccountPin, verifyAccountPin } from "@/services/userService";
import { createNotification } from "@/services/notificationService";
import type { AccountType, UserProfile } from "@/types";

type PendingAuth = {
  accountId?: string;
  phone: string;
  countryCode: string;
  isNew: boolean;
  hasPin: boolean;
  fullName?: string;
  accountType?: AccountType;
  profile?: UserProfile;
  pinHash?: string;
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
  const router = useRouter();
  const { acceptAuthenticatedUser } = useApp();
  const [pending, setPending] = useState<PendingAuth | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState(false);
  const finishInFlight = useRef(false);
  const pendingRef = useRef<PendingAuth | null>(null);
  const pinRef = useRef("");

  const storePending = (next: PendingAuth) => {
    pendingRef.current = next;
    setPending(next);
    if (next.fullName) setName(next.fullName);
    sessionStorage.setItem("vetkonnect:pending_auth", JSON.stringify(next));
  };

  useEffect(() => {
    warmSignInDestinations(router);
  }, [router]);

  useEffect(() => {
    const raw = sessionStorage.getItem("vetkonnect:pending_auth");
    if (!raw) {
      void navigate({ to: "/register" });
      return;
    }
    let parsed: PendingAuth;
    try {
      parsed = JSON.parse(raw) as PendingAuth;
    } catch {
      void navigate({ to: "/register" });
      return;
    }
    if (!parsed.phone) {
      void navigate({ to: "/register" });
      return;
    }
    storePending(parsed);
    if (parsed.accountId && parsed.profile) return;
    let alive = true;
    void beginAccessLookup(parsed.phone, parsed.countryCode, { accountType: parsed.accountType })
      .then((result) => {
        if (!alive) return;
        const next: PendingAuth = {
          accountId: result.accountId,
          phone: result.phone,
          countryCode: result.countryCode,
          isNew: result.isNew,
          hasPin: result.hasPin,
          fullName: result.fullName,
          accountType: parsed.accountType ?? result.profile.accountType,
          profile: result.profile,
          pinHash: result.pinHash,
        };
        storePending(next);
        if (!result.isNew && result.hasPin) {
          setConfirming(false);
          setFirstPin("");
          if (pinRef.current.length === PIN_LENGTH) void finish(pinRef.current);
        } else if (pinRef.current.length > 0) {
          pinRef.current = "";
          setPin("");
          setConfirming(false);
          setFirstPin("");
        }
      })
      .catch((error) => {
        if (!alive) return;
        toast.error(error instanceof Error ? error.message : "Could not open that number. Try again.");
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  const returning = Boolean(pending && !pending.isNew && pending.hasPin);
  const needsName = Boolean(pending?.isNew || !pending?.fullName);

  const finish = async (userPin: string) => {
    const current = pendingRef.current;
    if (!current || finishInFlight.current) return;
    if (!current.accountId || !current.profile) return;
    finishInFlight.current = true;
    setError(false);
    const signingIn = !current.isNew && current.hasPin;
    const accountId = current.accountId;
    try {
      const user = signingIn
        ? await verifyAccountPin({
            accountId: current.accountId,
            pin: userPin,
            pinHash: current.pinHash,
            profile: current.profile,
          })
        : await setAccountPin({
            accountId: current.accountId,
            pin: userPin,
            fullName: name.trim() || current.fullName,
            profile: current.profile,
          });
      acceptAuthenticatedUser(user);
      sessionStorage.removeItem("vetkonnect:pending_auth");
      const destination = getAppHomePath(user);
      void createNotification({
        accountId: user.id,
        title: signingIn ? "Signed in" : "PIN saved",
        body: signingIn
          ? "Welcome back to VetKonnect."
          : user.accountType === "vet"
            ? "Your practice PIN is ready. Patients and Impact unlock after admin verification."
            : "Your 5-digit PIN is ready. Use it whenever you sign in.",
        type: "security",
      }).catch(() => undefined);
      document.documentElement.style.visibility = "hidden";
      window.location.replace(destination);
    } catch (err) {
      const incorrect = err instanceof IncorrectPinError;
      const message = incorrect
        ? "Incorrect PIN. That PIN does not match this number."
        : err instanceof Error
          ? err.message
          : "Could not check that PIN.";
      sessionStorage.setItem("vetkonnect:auth_notice", message);
      sessionStorage.removeItem("vetkonnect:pending_auth");
      if (incorrect && accountId) {
        void createNotification({
          accountId,
          title: "Incorrect PIN",
          body: "A sign-in attempt used the wrong PIN. If this was not you, keep your PIN private.",
          type: "security",
        }).catch(() => undefined);
      }
      document.documentElement.style.visibility = "hidden";
      window.location.replace("/register");
    }
  };

  const onPinChange = (next: string) => {
    setError(false);
    pinRef.current = next;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (!pending?.accountId) return;
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
  const opening = !pending.accountId;

  return (
    <MobileScreen className="bg-white px-6 pb-6">
      <div className="flex justify-center pt-4">
        <Logo size="sm" />
      </div>

      {opening || returning ? (
        <>
          <h1 className="mt-5 text-center text-2xl font-extrabold text-primary">{returning ? "Welcome back" : "Enter your PIN"}</h1>
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
        <PinPad value={pin} onChange={onPinChange} error={error} />
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/register" })}
        className="mx-auto mt-4 block cursor-pointer text-sm font-medium text-primary underline"
      >
        Change number
      </button>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        {opening ? "Opening this number…" : confirming ? "Enter the same 5 digits again." : returning ? "Your PIN is checked as soon as the fifth digit is entered." : "The PIN is saved after you confirm it."}
      </p>
    </MobileScreen>
  );
}
