import { useRef, useState, type RefObject } from "react";
import { uploadMealPhoto } from "../../../lib/api";
import { prepareMealPhotoBlob, withTimeout } from "../../../lib/mealPhoto";
import { MealPhotoView } from "./MealPhotoView";

interface MealPhotoPickerProps {
  label?: string;
  imageUrl?: string;
  onChange: (imageUrl: string | undefined) => void;
}

const UPLOAD_TIMEOUT_MS = 30_000;
const PROCESS_TIMEOUT_MS = 60_000;

export function MealPhotoPicker({
  label = "Photo (optional)",
  imageUrl,
  onChange,
}: MealPhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetFileInputs = () => {
    resetInput(cameraInputRef);
    resetInput(uploadInputRef);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const blob = await withTimeout(
        prepareMealPhotoBlob(file),
        PROCESS_TIMEOUT_MS,
        "Photo processing timed out. Try again or choose a different image.",
      );
      const url = await withTimeout(
        uploadMealPhoto(blob, file.name.replace(/\.[^.]+$/, ".jpg")),
        UPLOAD_TIMEOUT_MS,
        "Upload timed out. Check your connection and try again.",
      );
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photo.");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
      resetFileInputs();
    }
  };

  const openCamera = () => {
    resetInput(cameraInputRef);
    cameraInputRef.current?.click();
  };

  const openUpload = () => {
    resetInput(uploadInputRef);
    uploadInputRef.current?.click();
  };

  const handleRemove = () => {
    onChange(undefined);
    resetFileInputs();
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-zinc-400">{label}</h2>

      {imageUrl ? (
        <div className="relative">
          <MealPhotoView src={imageUrl} alt="Meal preview" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
              <p className="text-sm font-medium text-zinc-100">Uploading photo…</p>
            </div>
          )}
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={openUpload}
              className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-zinc-100 backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-50"
            >
              Change
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleRemove}
              className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-zinc-100 backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={openCamera}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/6 disabled:opacity-50"
          >
            <CameraIcon />
            Take photo
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={openUpload}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/6 disabled:opacity-50"
          >
            <UploadIcon />
            Upload photo
          </button>
        </div>
      )}

      {!imageUrl && isLoading && (
        <p className="mt-2 text-xs text-zinc-500">Uploading photo…</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
        }}
      />
    </section>
  );
}

function resetInput(ref: RefObject<HTMLInputElement | null>) {
  if (ref.current) ref.current.value = "";
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
