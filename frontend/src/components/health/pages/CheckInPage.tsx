import { useState, type ReactNode } from "react";
import { isCheckInValid, MAX_WEIGHT_KG, MIN_WEIGHT_KG, parseWeightKg } from "../../../lib/checkIn";
import type { CheckIn } from "../../../types/health";
import { PageShell } from "../../layout/PageShell";
import { DecimalInput } from "../../shared/DecimalInput";
import { CheckInPhotoPicker, type CheckInPhotoItem } from "../CheckInPhotoPicker";

interface CheckInPageProps {
  checkInDate: string;
  initialCheckIn?: CheckIn;
  onBack: () => void;
  onConfirm: (payload: { weightKg: number | null; photoPaths: string[] }) => void | Promise<void>;
}

export function CheckInPage({
  checkInDate,
  initialCheckIn,
  onBack,
  onConfirm,
}: CheckInPageProps) {
  const [weight, setWeight] = useState(
    initialCheckIn?.weightKg != null ? String(initialCheckIn.weightKg) : "",
  );
  const [photos, setPhotos] = useState<CheckInPhotoItem[]>(
    () =>
      initialCheckIn?.photos.map((photo) => ({
        path: photo.imagePath,
        displayUrl: photo.imageUrl,
      })) ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoPaths = photos.map((photo) => photo.path);
  const isValid = isCheckInValid(weight, photoPaths);

  const handleConfirm = async () => {
    if (!isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm({
        weightKg: parseWeightKg(weight),
        photoPaths,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save check-in.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      title={initialCheckIn ? "Edit check-in" : "Add check-in"}
      subtitle="Weight and/or progress photos"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid || isSaving}
            onClick={handleConfirm}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : initialCheckIn ? "Save changes" : "Save check-in"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-28">
        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <Field label={`Weight (kg, optional · ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG})`}>
          <DecimalInput
            value={weight}
            onChange={setWeight}
            placeholder="e.g. 82.5"
            className={inputClass}
          />
        </Field>

        <CheckInPhotoPicker photos={photos} onChange={setPhotos} />

        <p className="text-xs text-zinc-500">
          Add at least a weight or one photo for {checkInDate}.
        </p>
      </div>
    </PageShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20 focus:bg-white/8";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
