import { useState, type ReactNode } from "react";
import type { DailyGoal } from "../../../types/nutrition";
import { PageShell } from "../../layout/PageShell";

interface GoalsSettingsPageProps {
  initialGoal: DailyGoal;
  onBack: () => void;
  onSave: (goal: DailyGoal) => void;
}

export function GoalsSettingsPage({ initialGoal, onBack, onSave }: GoalsSettingsPageProps) {
  const [calories, setCalories] = useState(String(initialGoal.calories));
  const [protein, setProtein] = useState(String(initialGoal.protein));
  const [carbs, setCarbs] = useState(String(initialGoal.carbs));
  const [fat, setFat] = useState(String(initialGoal.fat));

  const goal: DailyGoal = {
    calories: parsePositive(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  };

  const isValid = goal.calories > 0;

  return (
    <PageShell
      title="Daily goals"
      subtitle="Your targets for calories and macros"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onSave(goal)}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save goals
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-28">
        <p className="text-sm leading-relaxed text-zinc-500">
          These targets drive your progress ring, macro bars, and remaining budget on
          Today.
        </p>

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <h2 className="mb-4 text-sm font-medium text-amber-400">Calories</h2>
          <Field label="Daily calorie target (kcal)">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className={inputClass}
            />
          </Field>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <h2 className="mb-4 text-sm font-medium text-zinc-400">Macros (grams)</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Protein">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Carbs">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Fat">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/8";

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
