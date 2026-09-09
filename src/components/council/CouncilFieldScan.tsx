import { useState } from "react";
import { Phone, ShieldAlert, ShieldCheck, ShieldX, UserRound } from "lucide-react";
import { toast } from "sonner";
import { TagScanPanel } from "@/components/vet/TagScanPanel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { lookupPetForCouncil } from "@/services/councilService";
import type { CouncilTagScanResult } from "@/types";

export function CouncilFieldScan() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CouncilTagScanResult | null>(null);

  const onScan = async (value: string) => {
    setBusy(true);
    try {
      const lookup = await lookupPetForCouncil(value);
      setResult(lookup);
      if (lookup.registered) {
        toast.success(`${lookup.pet.name} is registered`);
      } else {
        toast.message("Pet not registered", {
          description: "This tag is not linked to a VetKonnect pet profile.",
        });
      }
    } catch (error) {
      setResult(null);
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 px-5 pb-8">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Field scan</h2>
        <p className="mt-1 text-sm text-slate-600">
          Scan the pet’s collar / QR tag. The profile shows whether the animal is registered, licence status, and owner
          details when available.
        </p>
      </div>

      <TagScanPanel onScan={onScan} busy={busy} />

      {result && !result.registered ? (
        <Card className="space-y-3 rounded-2xl border-rose-200 bg-rose-50/80 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <ShieldX className="size-6" />
            </span>
            <div>
              <Badge variant="secondary" className="bg-rose-700 text-white hover:bg-rose-700">
                Not registered
              </Badge>
              <h3 className="mt-2 text-lg font-bold text-rose-950">No pet profile for this tag</h3>
              <p className="mt-1 text-sm text-rose-900/80">
                Scanned code <span className="font-mono font-semibold">{result.scannedCode}</span> is not linked to a
                registered pet in VetKonnect. The animal may be unregistered or the tag may be unused.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {result?.registered ? (
        <Card className="space-y-4 rounded-2xl border-slate-200 p-4 shadow-sm">
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-teal-800 hover:bg-teal-800">Registered</Badge>
              <Badge
                variant="secondary"
                className={
                  result.licenceStatus === "licensed"
                    ? "bg-emerald-100 text-emerald-900"
                    : result.licenceStatus === "expired"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-slate-200 text-slate-700"
                }
              >
                {result.licenceStatus === "licensed"
                  ? "Licensed"
                  : result.licenceStatus === "expired"
                    ? "Licence expired"
                    : result.licenceStatus === "revoked"
                      ? "Licence revoked"
                      : "No municipal licence"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-teal-900/80">
              This pet tag matches a VetKonnect registry profile.
            </p>
          </div>

          <div className="flex items-start gap-3">
            {result.pet.photoUrl ? (
              <img src={result.pet.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <ShieldCheck className="size-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold text-slate-900">{result.pet.name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {result.pet.species} · {result.pet.breed} · {result.pet.sex}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                VK {result.pet.vetConnectId}
                {result.pet.collarId ? ` · Tag ${result.pet.collarId}` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Municipal licence</p>
            {result.licence ? (
              <div className="mt-1 space-y-1 text-sm text-slate-800">
                <p>
                  <span className="font-medium">{result.licence.licenceNumber}</span> · {result.licence.status}
                </p>
                <p className="text-xs text-slate-500">
                  Issued {result.licence.issuedAt} · Expires {result.licence.expiresAt}
                </p>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-sm text-amber-800">
                <ShieldAlert className="size-4 shrink-0" />
                Pet is registered in the app, but has no municipal licence on record.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered owner</p>
            {result.owner ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <UserRound className="size-4 text-teal-800" />
                  {result.owner.fullName}
                </div>
                {result.owner.phone ? (
                  <a
                    href={`tel:${result.owner.countryCode}${result.owner.phone}`}
                    className="inline-flex items-center gap-2 text-sm text-teal-800 underline"
                  >
                    <Phone className="size-4" />
                    {result.owner.countryCode} {result.owner.phone}
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">No phone on file.</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Owner account not linked or not found.</p>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
