import { Camera, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

export function TagScanPanel({
  onScan,
  busy,
}: {
  onScan: (value: string) => void | Promise<void>;
  busy?: boolean;
}) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setScanError(null);
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setScanError("Camera QR scan isn’t supported on this browser. Enter the tag ID instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera access isn’t available on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(() => void tick());
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes.find((item) => item.rawValue)?.rawValue?.trim();
          if (value) {
            stopCamera();
            setCode(value);
            await onScan(value);
            return;
          }
        } catch {
          // Keep scanning
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    } catch {
      stopCamera();
      setScanError("Could not open the camera. Check permissions, or type the tag ID.");
    }
  };

  const submit = async () => {
    if (!code.trim() || busy) return;
    await onScan(code.trim());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Search className="size-5 shrink-0 text-primary" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Tag / collar ID or VK-ZW-…"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          autoComplete="off"
          inputMode="text"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="hero" className="flex-1" disabled={!code.trim() || busy} onClick={() => void submit()}>
          {busy ? "Searching…" : "Find patient"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={busy}
          onClick={() => void (scanning ? stopCamera() : startCamera())}
        >
          {scanning ? <X className="size-4" /> : <Camera className="size-4" />}
          {scanning ? "Stop" : "Scan"}
        </Button>
      </div>

      {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}

      {scanning ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <p className="bg-black/80 px-3 py-2 text-center text-xs text-white/80">Point at a collar or pet tag QR</p>
        </div>
      ) : null}
    </div>
  );
}
