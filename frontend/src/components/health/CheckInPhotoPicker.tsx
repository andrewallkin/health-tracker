import { useRef, useState, type RefObject } from "react";
import { uploadCheckInPhoto } from "../../lib/api";
import { MAX_PHOTOS } from "../../lib/checkIn";
import { prepareMealPhotoBlob, withTimeout } from "../../lib/mealPhoto";
import { MealPhotoView } from "../nutrition/shared/MealPhotoView";

export interface CheckInPhotoItem {
  path: string;
  displayUrl: string;
}

interface CheckInPhotoPickerProps {
  photos: CheckInPhotoItem[];
  onChange: (photos: CheckInPhotoItem[]) => void;
}

const UPLOAD_TIMEOUT_MS = 30_000;
const PROCESS_TIMEOUT_MS = 60_000;

export function CheckInPhotoPicker({ photos, onChange }: CheckInPhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const atLimit = photos.length >= MAX_PHOTOS;

  const resetFileInputs = () => {
    resetInput(cameraInputRef);
    resetInput(uploadInputRef);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || inFlightRef.current || atLimit) return;

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const blob = await withTimeout(
        prepareMealPhotoBlob(file),
        PROCESS_TIMEOUT_MS,
        "Photo processing timed out. Try again or choose a different image.",
      );
      const { path, url } = await withTimeout(
        uploadCheckInPhoto(blob, file.name.replace(/\.[^.]+$/, ".jpg")),
        UPLOAD_TIMEOUT_MS,
        "Upload timed out. Check your connection and try again.",
      );
      onChange([...photos, { path, displayUrl: url }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photo.");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
      resetFileInputs();
    }
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  const openCamera = () => {
    if (atLimit) return;
    resetInput(cameraInputRef);
    cameraInputRef.current?.click();
  };

  const openUpload = () => {
    if (atLimit) return;
    resetInput(uploadInputRef);
    uploadInputRef.current?.click();
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400">Photos (optional)</h2>
        <span className="text-xs text-zinc-500">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {photos.map((photo, index) => (
            <div key={`${photo.path}-${index}`} className="relative">
              <MealPhotoView src={photo.displayUrl} alt={`Check-in photo ${index + 1}`} />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-zinc-100 backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!atLimit && (
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

      {isLoading && <p className="mt-2 text-xs text-zinc-500">Uploading photo…</p>}
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
