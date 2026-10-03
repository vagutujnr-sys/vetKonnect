import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { DvsCertificateVisual } from "@/components/dvs/DvsCertificateVisual";
import { Badge } from "@/components/ui/badge";
import { logCertificateVerification } from "@/services/dvsService";
import type { DvsCertificate, DvsQrScanResult } from "@/types";

export const Route = createFileRoute("/certificate/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Verify certificate ${params.code} — DVS` },
      { name: "description", content: "Real-time Department of Veterinary Services certificate verification." },
    ],
  }),
  component: CertificateVerify,
});

function CertificateVerify() {
  const { code } = Route.useParams();
  const [result, setResult] = useState<DvsQrScanResult | null>(null);
  const [certificate, setCertificate] = useState<DvsCertificate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const outcome = await logCertificateVerification({
          code,
          scannerContext: "public_qr",
        });
        setCertificate(outcome.certificate);
        setResult(outcome.result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed.");
      }
    })();
  }, [code]);

  const ok = result === "valid";

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
          Department of Veterinary Services
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold text-slate-900">Certificate verification</h1>

        {error ? <p className="mt-6 text-center text-sm text-destructive">{error}</p> : null}

        {!result && !error ? <p className="mt-8 text-center text-sm text-slate-500">Checking official records…</p> : null}

        {result ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-center gap-2">
              {ok ? <ShieldCheck className="size-6 text-emerald-700" /> : <ShieldX className="size-6 text-rose-700" />}
              <Badge className={ok ? "bg-emerald-700" : "bg-rose-700"}>{result.replace("_", " ")}</Badge>
            </div>
            <p className="mt-3 text-center text-sm text-slate-600">
              {ok
                ? "This is a valid official DVS rabies vaccination certificate."
                : result === "not_found"
                  ? "No certificate matches this QR / verification code."
                  : `This certificate is recorded as ${result}. It should not be accepted as current proof of vaccination.`}
            </p>
          </div>
        ) : null}

        {certificate ? (
          <div className="mt-6">
            <DvsCertificateVisual certificate={certificate} />
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">Verification logged for DVS audit. Powered by VetKonnect.</p>
      </div>
    </div>
  );
}
