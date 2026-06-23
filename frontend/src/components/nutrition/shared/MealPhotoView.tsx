import { useEffect, useState } from "react";

interface MealPhotoViewProps {
  src: string;
  alt: string;
  className?: string;
  size?: "full" | "thumbnail";
}

export function MealPhotoView({ src, alt, className, size = "full" }: MealPhotoViewProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const isThumbnail = size === "thumbnail";

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`group relative overflow-hidden border border-white/10 bg-black/20 ${
          isThumbnail
            ? "h-16 w-16 shrink-0 rounded-xl"
            : `block w-full rounded-2xl ${className ?? ""}`
        }`}
        aria-label="View full photo"
      >
        <img
          src={src}
          alt={alt}
          className={
            isThumbnail
              ? "h-full w-full object-cover"
              : "max-h-56 w-full object-contain"
          }
        />
        {!isThumbnail && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 text-right text-xs text-zinc-300 opacity-70 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-active:opacity-100">
            Tap to expand
          </span>
        )}
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Meal photo"
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-zinc-200 transition hover:bg-white/20"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
