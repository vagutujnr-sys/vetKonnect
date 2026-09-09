import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronsUpDown, Lock, Phone, ShieldCheck, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/hooks/useApp";
import { getAppHomePath } from "@/lib/account";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_ISO,
  countryFlagEmoji,
  findCountryByIso,
} from "@/lib/countryDialCodes";
import { cn } from "@/lib/utils";
import { getUser, hasActiveSession, requestAccessCode } from "@/services/userService";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await hasActiveSession();
    if (!session) return;
    const user = await getUser();
    throw redirect({ to: getAppHomePath(user) });
  },
  head: () => ({
    meta: [
      { title: "Login — VetKonnect" },
      { name: "description", content: "Sign in or create your VetKonnect account with your mobile number." },
      { property: "og:title", content: "Login — VetKonnect" },
      { property: "og:description", content: "Device-bound secure login for VetKonnect." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const { refreshSession } = useApp();
  const [phone, setPhone] = useState("");
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [countryOpen, setCountryOpen] = useState(false);
  const [registerAsVet, setRegisterAsVet] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCountry = useMemo(
    () => findCountryByIso(countryIso) ?? findCountryByIso(DEFAULT_COUNTRY_ISO)!,
    [countryIso],
  );

  const submit = async () => {
    setLoading(true);
    try {
      const result = await requestAccessCode(phone, selectedCountry.dial, {
        accountType: registerAsVet ? "vet" : "owner",
      });

      if (result.skipVerify && result.user) {
        await refreshSession();
        toast.success("Signed in", {
          description: "Signed in on this trusted device.",
        });
        void navigate({ to: getAppHomePath(result.user) });
        return;
      }

      sessionStorage.setItem(
        "vetkonnect:pending_auth",
        JSON.stringify({
          accountId: result.accountId,
          otp: result.otp,
          phone: result.phone,
          countryCode: result.countryCode,
          isNew: result.isNew,
          expiresAt: result.expiresAt,
          accountType: registerAsVet ? "vet" : "owner",
        }),
      );
      toast.success("Unique access code created", {
        description: registerAsVet
          ? "Continue to secure your vet account on this device."
          : "Enter the code on the next screen to bind this device.",
      });
      void navigate({ to: "/verify" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileScreen className="bg-white px-6">
      <div className="flex justify-center pt-14">
        <Logo size="lg" stacked />
      </div>

      <p className="mt-8 text-center text-[15px] text-muted-foreground">
        Enter your mobile number to create an account or sign in. Your account will be bound to this device.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur">
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left outline-none"
              aria-label="Select country code"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {countryFlagEmoji(selectedCountry.iso)}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {selectedCountry.name} ({selectedCountry.dial})
              </span>
              <ChevronsUpDown className="size-5 shrink-0 text-primary" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-3rem,22rem)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search country or code…" />
              <CommandList className="max-h-64">
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {COUNTRY_DIAL_CODES.map((country) => (
                    <CommandItem
                      key={country.iso}
                      value={`${country.name} ${country.dial} ${country.iso}`}
                      onSelect={() => {
                        setCountryIso(country.iso);
                        setCountryOpen(false);
                      }}
                    >
                      <span className="mr-2 text-lg leading-none" aria-hidden>
                        {countryFlagEmoji(country.iso)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{country.name}</span>
                      <span className="ml-2 shrink-0 text-muted-foreground">{country.dial}</span>
                      <Check
                        className={cn(
                          "ml-2 size-4 shrink-0",
                          countryIso === country.iso ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-3 px-4 py-4">
          <Phone className="size-5 text-primary" />
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">{selectedCountry.dial}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter mobile number"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card/80 px-4 py-4 backdrop-blur">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent">
          <Stethoscope className="size-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-foreground">Register as Vet</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Open the practice app by default. Patients & Impact unlock after admin verification.
          </span>
        </span>
        <Switch checked={registerAsVet} onCheckedChange={setRegisterAsVet} aria-label="Register as Vet" />
      </label>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-accent/60 p-4 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          VetKonnect uses a unique access code each time — no SMS. After login, this account stays locked to this
          device until you unbind it in Settings.
        </p>
      </div>

      <Button
        variant="hero"
        size="lg"
        disabled={phone.trim().length < 6 || loading}
        onClick={() => void submit()}
        className="mt-8 w-full justify-between text-base tracking-wide"
      >
        {loading ? "Checking…" : "CONTINUE"}
        <ArrowRight className="size-5" />
      </Button>

      <div className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          By continuing, you agree to our <span className="text-primary">Terms of Service</span> and{" "}
          <span className="text-primary">Privacy Policy</span>.
        </p>
      </div>
    </MobileScreen>
  );
}
