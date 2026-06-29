import { useState } from "react";
import { scaleMacros } from "../../../lib/aggregates";
import { addToDayLabel } from "../../../lib/logLabels";
import type { LogFoodPayload } from "../../../lib/logEntry";
import { defaultMealSlot } from "../../../lib/quickLog";
import { findSavedFood } from "../../../lib/savedFood";
import { FOOD_TAG_LABELS } from "../../../lib/foodTags";
import type { FoodTag, MealSlot, SavedFood } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";
import { MealPhotoView } from "../shared/MealPhotoView";
import { PageShell } from "../../layout/PageShell";

interface LogFoodPageProps {
  foods: SavedFood[];
  foodId: string;
  logDate: string;
  onBack: () => void;
  onConfirm: (payload: LogFoodPayload) => void | Promise<void>;
}

const slots: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function LogFoodPage({
  foods,
  foodId,
  logDate,
  onBack,
  onConfirm,
}: LogFoodPageProps) {
  const food = findSavedFood(foods, foodId);
  const [slot, setSlot] = useState<MealSlot>(defaultMealSlot());
  const [portions, setPortions] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!food) {
    return (
      <PageShell title="Food not found" onBack={onBack}>
        <p className="text-sm text-zinc-500">This saved food could not be loaded.</p>
      </PageShell>
    );
  }

  const scaled = scaleMacros(food, portions);

  const handleConfirm = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm({ slot, portions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      title="Log food"
      subtitle={food.name}
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleConfirm}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : addToDayLabel(logDate)}
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

        {food.imageUrl ? (
          <MealPhotoView src={food.imageUrl} alt={food.name} />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/4">
            <span className="text-4xl opacity-30">🥗</span>
          </div>
        )}

        {food.description && (
          <p className="text-sm leading-relaxed text-zinc-400">{food.description}</p>
        )}

        {(food.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {food.tags!.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-500"
              >
                {FOOD_TAG_LABELS[tag as FoodTag]}
              </span>
            ))}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition preview</h2>
          <MacroChips macros={scaled} size="md" />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Meal slot</h2>
          <div className="grid grid-cols-2 gap-2">
            {slots.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSlot(value)}
                className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                  slot === value
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                    : "border-white/10 bg-white/4 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Portions</h2>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
            <button
              type="button"
              onClick={() => setPortions((p) => Math.max(0.5, +(p - 0.5).toFixed(1)))}
              disabled={portions <= 0.5}
              aria-label="Decrease portions"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition hover:bg-white/10 disabled:opacity-30"
            >
              <MinusIcon />
            </button>
            <div className="text-center">
              <span className="text-2xl font-bold tabular-nums text-white">×{portions}</span>
              <p className="mt-0.5 text-xs text-zinc-500">portions</p>
            </div>
            <button
              type="button"
              onClick={() => setPortions((p) => +(p + 0.5).toFixed(1))}
              aria-label="Increase portions"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition hover:bg-white/10"
            >
              <PlusIcon />
            </button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function MinusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
