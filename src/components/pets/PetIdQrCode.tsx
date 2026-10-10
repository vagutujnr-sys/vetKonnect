import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PetIdQrCode({ vetConnectId, className }: { vetConnectId: string; className: string }) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(vetConnectId, { margin: 1, width: 240 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [vetConnectId]);

  return qr ? (
    <img src={qr} alt={`QR code for VetKonnect ID ${vetConnectId}`} className={className} />
  ) : (
    <div role="img" aria-label={`QR code for VetKonnect ID ${vetConnectId}`} className={className} />
  );
}