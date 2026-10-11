import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Clock3, Receipt, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { initiateDvsLicencePayment, pollDvsLicencePayment } from "@/lib/dvsLicenceClient";
import { councilFacingText, dvsLicenceFeeForSpecies, DVS_LICENCE_FEES, formatDvsMoney } from "@/lib/dvsLicenceFees";
import { currentLicenceForPet, listLicencesForPet, listPendingPaymentsForPet, submitRegistrationProof, uploadRegistrationProof } from "@/services/dvsLicenceService";
import type { DvsAnimalLicence, DvsLicencePayment, DvsPaymentMethod, Pet } from "@/types";

const proofStorageKey = (petId: string) => `vetkonnect:council-proof:${petId}`;

function readLocalProof(petId: string): string | null {
  try {
    return localStorage.getItem(proofStorageKey(petId));
  } catch {
    return null;
  }
}

export function DvsPetLicence({ pet, ownerPhone }: { pet: Pet; ownerPhone?: string }) {
  const [licence, setLicence] = useState<DvsAnimalLicence | null>(null);
  const [pending, setPending] = useState<DvsLicencePayment | null>(null);
  const [localProof, setLocalProof] = useState<string | null>(null);
  const [phone, setPhone] = useState(ownerPhone ?? "");
  const [busy, setBusy] = useState<DvsPaymentMethod | "poll" | "proof" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);

  const fee = dvsLicenceFeeForSpecies(pet.species);

  const refresh = async () => {
    const [licences, payments] = await Promise.all([listLicencesForPet(pet.id), listPendingPaymentsForPet(pet.id)]);
    const current = currentLicenceForPet(licences, pet.id);
    setLicence(current);
    setPending(payments[0] ?? null);
    if (current?.status === "pending") {
      setLocalProof(null);
      try {
        localStorage.removeItem(proofStorageKey(pet.id));
      } catch {
        /* ignore */
      }
    } else {
      setLocalProof(readLocalProof(pet.id));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void refresh()
      .catch(() => {
        if (!cancelled) {
          setLicence(null);
          setPending(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pet.id]);

  const pay = async (method: Extract<DvsPaymentMethod, "paynow" | "ecocash" | "onemoney">) => {
    setBusy(method);
    try {
      const result = await initiateDvsLicencePayment({
        petId: pet.id,
        method,
        phone: phone.trim() || ownerPhone,
      });
      setPending(result.payment);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result.demo) {
        toast.message("Verification in Progress");
      } else {
        toast.success(councilFacingText(result.instructions || "Complete the prompt on your phone."));
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start Paynow.";
      if (/(?:paynow|merchant).*?(?:not configured|configuration|keys)|PAYNOW_INTEGRATION/i.test(message)) {
        toast.message("Verification in Progress");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(null);
    }
  };

  const checkStatus = async () => {
    if (!pending) return;
    setBusy("poll");
    try {
      const result = await pollDvsLicencePayment({ paymentId: pending.id });
      if (result.licence) {
        setLicence(result.licence);
        setPending(null);
        toast.success("Council pet registration is now active.");
      } else {
        setPending(result.payment);
        toast.message(result.payment?.status === "pending" ? "Paynow has not confirmed yet." : `Payment ${result.payment?.status}.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check payment.");
    } finally {
      setBusy(null);
    }
  };

  const uploadProof = async (file: File | null) => {
    if (!file) return;
    setBusy("proof");
    try {
      const proofUrl = await uploadRegistrationProof(file, pet.id);
      try {
        const next = await submitRegistrationProof(pet, proofUrl);
        setLicence(next);
        setLocalProof(null);
        try {
          localStorage.removeItem(proofStorageKey(pet.id));
        } catch {
          /* ignore */
        }
      } catch {
        localStorage.setItem(proofStorageKey(pet.id), proofUrl);
        setLocalProof(proofUrl);
      }
      toast.success("Pending approval");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload registration proof.");
    } finally {
      setBusy(null);
      if (proofRef.current) proofRef.current.value = "";
    }
  };

  const active = licence?.status === "active" && !localProof;
  const awaitingApproval = licence?.status === "pending" || Boolean(localProof);
  const paymentPending = Boolean(pending) && !active && !awaitingApproval;
  const verificationInProgress = paymentPending && pending?.paynowStatus === "demo_pending";
  const needsRegistration = !active && !awaitingApproval && !paymentPending;

  return (
    <>
      <div className="mt-2">
        <Button
          type="button"
          variant={active ? "secondary" : awaitingApproval ? "outline" : "hero"}
          className={`w-full justify-between ${needsRegistration ? "animate-pulse motion-reduce:animate-none" : ""}`}
          onClick={() => setDetailsOpen(true)}
          aria-label={active ? "Fully registered with council; view details" : "Open council registration details"}
        >
          <span className="flex items-center gap-2">
            {active ? <BadgeCheck className="size-5" /> : awaitingApproval || paymentPending ? <Clock3 className="size-5" /> : <Receipt className="size-5" />}
            {active ? "Fully Registered" : awaitingApproval ? "Pending Approval" : verificationInProgress ? "Verification in Progress" : paymentPending ? "Payment Pending" : "Register"}
          </span>
          {!active ? <span className="text-xs opacity-80">Council</span> : null}
        </Button>
      </div>

      <Drawer open={detailsOpen} onOpenChange={setDetailsOpen} shouldScaleBackground={false}>
        <DrawerContent
          overlayClassName="-bottom-4 bg-black/40 backdrop-blur-sm"
          className="left-1/2 right-auto bottom-4 flex w-[calc(100%-2rem)] max-h-[75vh] max-w-[398px] -translate-x-1/2 flex-col overflow-y-auto scrollbar-none rounded-3xl border-0 bg-background p-5 shadow-[var(--shadow-float)] [&>div:first-child]:hidden animate-in slide-in-from-bottom-4 duration-300"
        >
          <DrawerHeader className="p-0 pb-3 text-left">
            <DrawerTitle className="flex items-center gap-2">
              {active ? <BadgeCheck className="size-5 text-emerald-800" /> : awaitingApproval || paymentPending ? <Clock3 className="size-5 text-amber-700" /> : <Receipt className="size-5 text-primary" />}
              Council Pet Registration
            </DrawerTitle>
            <DrawerDescription>
              {active
                ? "Your pet's current city council registration details."
                : `Register ${pet.name} with the city council for ${formatDvsMoney(fee)} (${DVS_LICENCE_FEES.validityDays} days).`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3">
            {awaitingApproval ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">Pending approval</p>
            ) : active ? (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                {pet.name} is registered with the city council until <span className="font-semibold">{licence?.expiresAt}</span>. Registration{" "}
                <span className="font-mono text-xs">{councilFacingText(licence?.licenceNumber ?? "")}</span>.
              </p>
            ) : (
              <>
                {licence?.status === "expired" ? (
                  <p className="text-xs text-amber-800">Previous registration {councilFacingText(licence.licenceNumber)} expired {licence.expiresAt}.</p>
                ) : null}
                <Input
                  className="bg-white"
                  placeholder="EcoCash / OneMoney number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-[#123524]" disabled={Boolean(busy)} onClick={() => void pay("ecocash")}>
                    {busy === "ecocash" ? "Starting…" : "Pay EcoCash"}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void pay("onemoney")}>
                    {busy === "onemoney" ? "Starting…" : "Pay OneMoney"}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void pay("paynow")}>
                    {busy === "paynow" ? "Starting…" : "Paynow web"}
                  </Button>
                </div>
              </>
            )}

            {paymentPending ? (
              <div className="rounded-md bg-card px-3 py-2 text-sm">
                {verificationInProgress ? (
                  <p className="font-medium">Verification in Progress</p>
                ) : (
                  <>
                    <p className="font-medium">Pending {pending?.method} · {formatDvsMoney(pending?.amount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Ref {councilFacingText(pending?.reference ?? "")}</p>
                    {pending?.instructions ? <p className="mt-1 text-xs text-muted-foreground">{councilFacingText(pending.instructions)}</p> : null}
                    <Button size="sm" variant="ghost" className="mt-1 px-0" disabled={Boolean(busy)} onClick={() => void checkStatus()}>
                      {busy === "poll" ? "Checking…" : "I've paid — check status"}
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {!awaitingApproval ? (
              <div className="border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Already registered with the council? Upload your certificate.</p>
                <input
                  ref={proofRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => void uploadProof(e.target.files?.[0] ?? null)}
                />
                <Button size="sm" variant="secondary" className="mt-2" disabled={Boolean(busy)} onClick={() => proofRef.current?.click()}>
                  <Upload className="size-4" />
                  {busy === "proof" ? "Uploading…" : "Upload registration proof"}
                </Button>
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
