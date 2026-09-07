import { X } from "lucide-react";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
        aria-label="Close image"
      >
        <X className="size-5" />
      </button>
      <img
        src={src}
        alt={alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-300"
      />
    </div>
  );
}
