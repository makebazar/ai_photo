import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, X } from "lucide-react";
import * as React from "react";
import { SmartImage } from "../../components/ui/SmartImage";
import { cn } from "../../lib/cn";
import type { MockPhoto } from "../../mock/photos";

export function Lightbox({
  open,
  photos,
  index,
  onChangeIndex,
  onClose,
}: {
  open: boolean;
  photos: MockPhoto[];
  index: number;
  onChangeIndex: (idx: number) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const hasPhotos = photos.length > 0;
  const safeIndex = hasPhotos ? ((index % photos.length) + photos.length) % photos.length : 0;
  const photo = hasPhotos ? photos[safeIndex] : null;
  const [downloading, setDownloading] = React.useState(false);

  const go = React.useCallback(
    (dir: -1 | 1) => {
      if (!hasPhotos) return;
      onChangeIndex(((safeIndex + dir) % photos.length + photos.length) % photos.length);
    },
    [hasPhotos, onChangeIndex, photos.length, safeIndex],
  );

  const downloadCurrent = React.useCallback(async () => {
    if (!photo?.url || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(photo.url, { mode: "cors" });
      if (!res.ok) throw new Error("Bad response");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-photo-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open original url (mobile browsers will allow Save/Share).
      window.open(photo.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }, [downloading, photo?.id, photo?.url]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, onClose, open]);

  if (!open || !hasPhotos || !photo) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] bg-black/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="absolute inset-0" onClick={onClose} aria-label="Close" />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/70 to-transparent" />

          <div className="absolute left-3 top-3 z-20 flex gap-2">
            <button
              className={cn(
                "pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stroke bg-graphite/55 text-white/85 backdrop-blur hover:bg-white/8",
              )}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <button
              className={cn(
                "pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stroke bg-graphite/55 text-white/85 backdrop-blur hover:bg-white/8",
                downloading && "opacity-60",
              )}
              onClick={downloadCurrent}
              aria-label="Download"
              disabled={downloading || !photo.url}
            >
              <Download size={18} />
            </button>
          </div>

          <motion.div
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              const threshold = 70;
              if (info.offset.x > threshold) go(-1);
              if (info.offset.x < -threshold) go(1);
            }}
            aria-label="Swipe area"
          />

          <motion.div
            key={photo.id}
            initial={{ opacity: 0.75 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.75 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.14 }}
            className="absolute inset-0 z-[5] flex items-center justify-center"
          >
            <SmartImage
              src={photo.url}
              alt={photo.label}
              fallbackSeed={safeIndex}
              loading="eager"
              fit="contain"
              frame={false}
              className="h-full w-full"
            />
          </motion.div>

          <div
            className={cn(
              "pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2",
              "pb-[env(safe-area-inset-bottom)]",
            )}
          >
            <div className="rounded-full border border-stroke bg-graphite/55 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    className={cn(
                      "h-2 w-2 rounded-full transition",
                      i === safeIndex ? "bg-neonBlue/90" : "bg-white/20 hover:bg-white/35",
                    )}
                    onClick={() => onChangeIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
