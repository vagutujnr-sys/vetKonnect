import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DvsCertificate } from "@/types";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-900/60">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value?.trim() || "—"}</p>
    </div>
  );
}

const STATUS_CLASS: Record<DvsCertificate["status"], string> = {
  valid: "bg-emerald-700 text-white",
  expired: "bg-amber-600 text-white",
  cancelled: "bg-rose-700 text-white",
  amended: "bg-slate-600 text-white",
  suspicious: "bg-red-800 text-white",
};

export function DvsCertificateVisual({
  certificate,
  className,
}: {
  certificate: DvsCertificate;
  className?: string;
}) {
  const [qr, setQr] = useState<string>("");
  const payload =
    certificate.qrPayload ||
    (typeof window === "undefined" ? certificate.verificationCode : `${window.location.origin}/certificate/${certificate.verificationCode}`);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border-2 border-emerald-900/20 bg-[#f7f4ea] shadow-lg",
        className,
      )}
    >
      <header className="bg-[#123524] px-6 py-5 text-center text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">Republic of Zimbabwe</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">Department of Veterinary Services</h2>
        <p className="mt-1 text-sm text-emerald-100">Official Rabies Vaccination Certificate</p>
      </header>
      <div className="h-1.5 bg-amber-500" />

      <div className="grid gap-5 px-6 py-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-sm font-bold text-emerald-950">{certificate.certificateNumber}</p>
            <Badge className={STATUS_CLASS[certificate.status]}>{certificate.status}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Animal" value={certificate.petName} />
            <Field label="Species / breed" value={`${certificate.species ?? "—"} · ${certificate.breed ?? "—"}`} />
            <Field label="Microchip" value={certificate.microchip} />
            <Field label="VetKonnect ID" value={certificate.vetconnectId} />
            <Field label="Owner" value={certificate.ownerName} />
            <Field label="Owner phone" value={certificate.ownerPhone} />
            <Field label="Vaccine" value={certificate.vaccineName} />
            <Field label="Batch" value={certificate.batchNumber ? `${certificate.manufacturer ?? ""} · ${certificate.batchNumber}` : undefined} />
            <Field label="Date given" value={certificate.issuedAt} />
            <Field label="Valid until" value={certificate.expiresAt} />
            <Field label="Veterinarian" value={certificate.veterinarianName} />
            <Field label="Practice" value={certificate.practiceName} />
            <Field label="Province" value={certificate.province} />
            <Field label="District" value={certificate.district} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-start gap-2">
          {qr ? <img src={qr} alt="Certificate verification QR" className="h-32 w-32 rounded-lg bg-white p-1" /> : null}
          <p className="text-center font-mono text-[10px] text-slate-600">{certificate.verificationCode}</p>
          <p className="max-w-[8rem] text-center text-[10px] text-slate-500">Scan to verify with DVS</p>
        </div>
      </div>

      <footer className="border-t border-emerald-900/10 bg-[#123524] px-6 py-3 text-center text-[11px] text-emerald-100">
        Official record held by DVS. Technology by VetKonnect.
      </footer>
    </article>
  );
}
