import { useState } from "react";
import { mockEstimateFood } from "../../../lib/mockEstimator";
import type { DescribeFoodInput } from "../../../types/foodEstimate";
import { MealPhotoPicker } from "../shared/MealPhotoPicker";
import { PageShell } from "../../layout/PageShell";

interface DescribeFoodPageProps {
  initialInput?: DescribeFoodInput;
  onBack: () => void;
  onEstimated: (input: DescribeFoodInput, estimate: Awaited<ReturnType<typeof mockEstimateFood>>) => void;
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
      const estimate = await mockEstimateFood(input);
      onEstimated(input, estimate);
    } catch {
      setError("Could not generate an estimate. Try again.");
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <PageShell
      title="Describe or photo"
      subtitle="Mock AI estimate — no backend yet"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!canEstimate || isEstimating}
            onClick={() => void handleEstimate()}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-green-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-green-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEstimating ? "Estimating…" : "Estimate macros"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-28">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">Description</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Sweet potato chilli mince, one bowl. Or: ate 2 servings from label (420 kJ per serving)…"
            rows={4}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20 focus:bg-white/8"
          />
        </label>

        <MealPhotoPicker
          label="Photo or label (optional)"
          imageUrl={photoUrl}
          onChange={setPhotoUrl}
        />

        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </PageShell>
  );
}
