import { useState } from "react";
import { scaleMacros } from "../../../lib/aggregates";
import { addToDayLabel } from "../../../lib/logLabels";
import type { LogMealPayload } from "../../../lib/logEntry";
import { findSavedMeal, formatMealIngredientList } from "../../../lib/savedMeal";
import type { MealSlot, SavedMeal } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";
import { MealPhotoView } from "../shared/MealPhotoView";
import { PageShell } from "../../layout/PageShell";

interface LogMealPageProps {
  meals: SavedMeal[];
  mealId: string;
  logDate: string;
  isEditing?: boolean;
  initialSlot?: MealSlot;
  initialServings?: number;
  onBack: () => void;
  onConfirm: (payload: LogMealPayload) => void | Promise<void>;
}

const slots: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function defaultSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

export function LogMealPage({
  meals,
  mealId,
  logDate,
  isEditing = false,
  initialSlot,
  initialServings,
  onBack,
  onConfirm,
}: LogMealPageProps) {
  const meal = findSavedMeal(meals, mealId);
  const [slot, setSlot] = useState<MealSlot>(initialSlot ?? defaultSlot());
  const [servings, setServings] = useState(initialServings ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!meal) {
    return (
      <PageShell title="Meal not found" onBack={onBack}>
        <p className="text-sm text-zinc-500">This saved meal could not be loaded.</p>
      </PageShell>
    );
  }

  const scaled = scaleMacros(meal, servings);

  const handleConfirm = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm({ slot, servings });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      title={isEditing ? "Edit meal" : "Log meal"}
      subtitle={meal.name}
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleConfirm}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : addToDayLabel(logDate)}
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

        {meal.imageUrl ? (
          <MealPhotoView src={meal.imageUrl} alt={meal.name} />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/4">
            <span className="text-4xl opacity-30">🍽</span>
          </div>
        )}

        {meal.description && (
          <p className="text-sm leading-relaxed text-zinc-400">{meal.description}</p>
        )}

        {meal.kind === "composed" && meal.items.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-400">Ingredients</h2>
            <ul className="space-y-1.5">
              {meal.items.map((item) => (
                <li
                  key={item.foodId}
                  className="flex items-center justify-between text-sm text-zinc-300"
                >
                  <span>{item.foodName}</span>
                  <span className="text-zinc-500">
                    ×{item.quantity} · {Math.round(item.calories * servings)} kcal
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-600">{formatMealIngredientList(meal.items)}</p>
          </section>
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
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Servings</h2>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
            <button
              type="button"
              onClick={() => setServings((s) => Math.max(0.5, +(s - 0.5).toFixed(1)))}
              disabled={servings <= 0.5}
              aria-label="Decrease servings"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition hover:bg-white/10 disabled:opacity-30"
            >
              <MinusIcon />
            </button>
            <div className="text-center">
              <span className="text-2xl font-bold tabular-nums text-white">×{servings}</span>
              <p className="mt-0.5 text-xs text-zinc-500">servings</p>
            </div>
            <button
              type="button"
              onClick={() => setServings((s) => +(s + 0.5).toFixed(1))}
              aria-label="Increase servings"
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
