import { useEffect, useState } from "react";
import { Download, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { DvsCertificateVisual } from "@/components/dvs/DvsCertificateVisual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadDvsCertificatePdf } from "@/lib/dvsCertificatePdf";
import { listCertificatesForPet } from "@/services/dvsService";
import type { DvsCertificate } from "@/types";

export function DvsPetCertificates({ petId }: { petId: string }) {
  const [certificates, setCertificates] = useState<DvsCertificate[]>([]);
  const [open, setOpen] = useState<DvsCertificate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listCertificatesForPet(petId)
      .then((rows) => {
        if (!cancelled) setCertificates(rows);
      })
      .catch(() => {
        if (!cancelled) setCertificates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [petId]);

  if (!certificates.length) return null;

  return (
    <div className="mt-2 w-full rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-center gap-2">
        <ScrollText className="size-5 text-emerald-800" />
        <h3 className="font-semibold text-emerald-950">DVS official certificates</h3>
      </div>
      <p className="mt-1 text-xs text-emerald-900/70">Issued by the Department of Veterinary Services. Valid records appear here automatically.</p>
      <div className="mt-3 space-y-2">
        {certificates.map((cert) => (
          <div key={cert.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{cert.certificateNumber}</p>
              <p className="text-xs capitalize text-slate-500">
                {cert.status} · valid until {cert.expiresAt}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => setOpen(cert)}>
                View
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void downloadDvsCertificatePdf(cert).catch((error) =>
                    toast.error(error instanceof Error ? error.message : "Could not download PDF"),
                  );
                }}
              >
                <Download className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Official DVS certificate</DialogTitle>
          </DialogHeader>
          {open ? <DvsCertificateVisual certificate={open} /> : null}
          {open ? (
            <Button
              onClick={() => {
                void downloadDvsCertificatePdf(open).catch((error) =>
                  toast.error(error instanceof Error ? error.message : "Could not download PDF"),
                );
              }}
            >
              <Download className="mr-2 size-4" /> Download PDF
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
