import { useState, type ReactNode } from "react";
import type { NewSavedMealPayload } from "../../../lib/savedMeal";
import { MacroChips } from "../dashboard/MacroChips";
import { MealPhotoPicker } from "../shared/MealPhotoPicker";
import { PageShell } from "../../layout/PageShell";

interface NewMealPageProps {
  onBack: () => void;
  onSave: (payload: NewSavedMealPayload) => void;
}

export function NewMealPage({ onBack, onSave }: NewMealPageProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const payload: NewSavedMealPayload = {
    name,
    description: description.trim() || undefined,
    imageUrl,
    calories: parsePositive(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  };

  const isValid = name.trim().length > 0 && payload.calories > 0;

  return (
    <PageShell
      title="New meal"
      subtitle="Save to your library for quick logging"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onSave(payload)}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save meal
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-28">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chicken stir-fry"
            className={inputClass}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ingredients, notes…"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </Field>

        <MealPhotoPicker imageUrl={imageUrl} onChange={setImageUrl} />

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition per serving</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories (kcal)">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Protein (g)">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Carbs (g)">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Fat (g)">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {isValid && (
          <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Preview</h2>
            <MacroChips
              macros={{
                calories: payload.calories,
                protein: payload.protein,
                carbs: payload.carbs,
                fat: payload.fat,
              }}
              size="md"
            />
          </section>
        )}
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

function parseNonNegative(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function parsePositive(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}
