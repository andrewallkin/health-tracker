import { useRef, useState } from "react";
import { readMealPhoto } from "../../../lib/mealPhoto";

interface MealPhotoPickerProps {
  label?: string;
  imageUrl?: string;
  onChange: (imageUrl: string | undefined) => void;
}

export function MealPhotoPicker({
  label = "Photo (optional)",
  imageUrl,
  onChange,
}: MealPhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const dataUrl = await readMealPhoto(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-zinc-400">{label}</h2>

      {imageUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <img src={imageUrl} alt="Meal preview" className="h-44 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-zinc-100 backdrop-blur-sm transition hover:bg-black/75"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/6 disabled:opacity-50"
          >
            <CameraIcon />
            Take photo
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => uploadInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/6 disabled:opacity-50"
          >
            <UploadIcon />
            Upload photo
          </button>
        </div>
      )}

      {isLoading && <p className="mt-2 text-xs text-zinc-500">Processing photo…</p>}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </section>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
    </svg>
  );
}
