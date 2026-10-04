import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Clock3, Receipt, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
      toast.success(councilFacingText(result.instructions || (result.demo ? "Council pet registration request recorded." : "Complete the prompt on your phone.")));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start Paynow.");
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

  return (
    <div className="mt-2 w-full rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-center gap-2">
        {active ? <BadgeCheck className="size-5 text-emerald-800" /> : awaitingApproval ? <Clock3 className="size-5 text-emerald-800" /> : <Receipt className="size-5 text-emerald-800" />}
        <h3 className="font-semibold text-emerald-950">Council Pet Registration</h3>
      </div>
      {awaitingApproval ? (
        <p className="mt-2 text-sm font-semibold text-amber-800">Pending approval</p>
      ) : active ? (
        <p className="mt-2 text-sm text-emerald-900">
          {pet.name} is registered with the city council until <span className="font-semibold">{licence?.expiresAt}</span>. Registration{" "}
          <span className="font-mono text-xs">{councilFacingText(licence?.licenceNumber ?? "")}</span>.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-emerald-900/80">
            City council pet registration for the year. Fee {formatDvsMoney(fee)} ({DVS_LICENCE_FEES.validityDays} days).
          </p>
          {licence?.status === "expired" ? (
            <p className="mt-1 text-xs text-amber-800">Previous registration {councilFacingText(licence.licenceNumber)} expired {licence.expiresAt}.</p>
          ) : null}
          <Input
            className="mt-3 bg-white"
            placeholder="EcoCash / OneMoney number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
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
      {pending && !active && !awaitingApproval ? (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm">
          <p className="font-medium text-slate-900">Pending {pending.method} · {formatDvsMoney(pending.amount)}</p>
          <p className="text-xs text-slate-500">Ref {councilFacingText(pending.reference)}</p>
          {pending.instructions ? <p className="mt-1 text-xs text-slate-600">{councilFacingText(pending.instructions)}</p> : null}
          <Button size="sm" variant="ghost" className="mt-1 px-0" disabled={Boolean(busy)} onClick={() => void checkStatus()}>
            {busy === "poll" ? "Checking…" : "I've paid — check status"}
          </Button>
        </div>
      ) : null}
      {!awaitingApproval ? (
        <div className="mt-4 border-t border-emerald-200 pt-3">
          <p className="text-sm text-emerald-900/80">Already registered with the council? Upload your certificate.</p>
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
  );
}
