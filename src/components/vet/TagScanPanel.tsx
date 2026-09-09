import { Camera, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const stopCamera = () => {
    activeRef.current = false;
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

  const decodeFrame = async (
    video: HTMLVideoElement,
    detector: BarcodeDetectorLike | null,
  ): Promise<string | null> => {
    if (detector) {
      try {
        const codes = await detector.detect(video);
        const value = codes.find((item) => item.rawValue)?.rawValue?.trim();
        if (value) return value;
      } catch {
        // Fall through to jsQR
      }
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    return result?.data?.trim() || null;
  };

  const startCamera = async () => {
    setScanError(null);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setScanError("Camera scan needs HTTPS (or localhost). Open the secure app link and try again.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera access isn’t available on this device. Enter the tag ID instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      activeRef.current = true;
      setScanning(true);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        setScanError("Could not start the camera preview.");
        return;
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();

      const Detector = getBarcodeDetector();
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

      const tick = async () => {
        if (!activeRef.current || !videoRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try {
            const value = await decodeFrame(videoRef.current, detector);
            if (value && activeRef.current) {
              stopCamera();
              setCode(value);
              await onScan(value);
              return;
            }
          } catch {
            // Keep scanning
          }
        }
        if (activeRef.current) {
          rafRef.current = requestAnimationFrame(() => void tick());
        }
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    } catch (error) {
      stopCamera();
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("permission") || message.includes("denied") || message.includes("notallowed")) {
        setScanError("Camera permission denied. Allow camera access, or type the tag ID.");
      } else {
        setScanError("Could not open the camera. Check permissions, or type the tag ID.");
      }
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
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
          <p className="bg-black/80 px-3 py-2 text-center text-xs text-white/80">Point at a collar or pet tag QR</p>
        </div>
      ) : null}
    </div>
  );
}
