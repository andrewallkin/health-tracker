import { useState } from "react";
import { estimateFood } from "../../../lib/api";
import type { DescribeFoodInput, FoodEstimate } from "../../../types/foodEstimate";
import { MealPhotoPicker } from "../shared/MealPhotoPicker";
import { PageShell } from "../../layout/PageShell";

interface DescribeFoodPageProps {
  initialInput?: DescribeFoodInput;
  onBack: () => void;
  onEstimated: (input: DescribeFoodInput, estimate: FoodEstimate) => void;
}

export function DescribeFoodPage({ initialInput, onBack, onEstimated }: DescribeFoodPageProps) {
  const [note, setNote] = useState(initialInput?.note ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialInput?.photoUrl);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEstimate = note.trim().length > 0 || Boolean(photoUrl);

  const handleEstimate = async () => {
    if (!canEstimate) return;

    const input: DescribeFoodInput = {
      note: note.trim(),
      photoUrl,
    };

    setIsEstimating(true);
    setError(null);
    try {
      const estimate = await estimateFood(input);
      onEstimated(input, estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate an estimate. Try again.");
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <PageShell
      title="Describe or photo"
      subtitle="AI calorie and macro estimate"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!canEstimate || isEstimating}
            onClick={handleEstimate}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEstimating ? "Estimating…" : "Estimate"}
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

        <MealPhotoPicker imageUrl={photoUrl} onChange={setPhotoUrl} />

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">
            Description (optional if you added a photo)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. sweet potato chilli mince, one bowl"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/8"
          />
        </label>
      </div>
    </PageShell>
  );
}
