import { useState, type ReactNode } from "react";
import { addToDayLabel } from "../../../lib/logLabels";
import {
  defaultMealSlot,
  type QuickLogPayload,
} from "../../../lib/quickLog";
import type { LogEntry, MealSlot } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";
import { PageShell } from "../../layout/PageShell";

interface QuickLogPageProps {
  logDate: string;
  isEditing?: boolean;
  initialEntry?: LogEntry;
  onBack: () => void;
  onConfirm: (payload: QuickLogPayload) => void;
}

const slots: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function QuickLogPage({
  logDate,
  isEditing = false,
  initialEntry,
  onBack,
  onConfirm,
}: QuickLogPageProps) {
  const [name, setName] = useState(initialEntry?.name ?? "");
  const [slot, setSlot] = useState<MealSlot>(initialEntry?.slot ?? defaultMealSlot());
  const [calories, setCalories] = useState(String(initialEntry?.calories ?? ""));
  const [protein, setProtein] = useState(String(initialEntry?.protein ?? ""));
  const [carbs, setCarbs] = useState(String(initialEntry?.carbs ?? ""));
  const [fat, setFat] = useState(String(initialEntry?.fat ?? ""));

  const payload: QuickLogPayload = {
    name,
    slot,
    calories: parseNonNegative(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  };

  const isValid = name.trim().length > 0 && payload.calories > 0;

  return (
    <PageShell
      title={isEditing ? "Edit entry" : "Quick log"}
      subtitle={isEditing ? undefined : "One-off item, not saved to library"}
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onConfirm(payload)}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEditing ? "Save changes" : addToDayLabel(logDate)}
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
            placeholder="e.g. Oat latte"
            className={inputClass}
          />
        </Field>

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
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories (kcal)">
              <input
                type="number"
                min={0}
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
            <MacroChips macros={payload} size="md" />
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
