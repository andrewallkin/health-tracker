import { useMemo, useState, type ReactNode } from "react";
import { addToDayLabel } from "../../../lib/logLabels";
import type { FoodComponentSelection } from "../../../lib/composeFoods";
import { sumFoodComponents } from "../../../lib/composeFoods";
import { parseNonNegative } from "../../../lib/numericInput";
import {
  defaultMealSlot,
  type QuickLogPayload,
} from "../../../lib/quickLog";
import type { LogEntry, MealSlot, SavedFood } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";
import { FoodComposer } from "../shared/FoodComposer";
import { PageShell } from "../../layout/PageShell";
import { DecimalInput } from "../../shared/DecimalInput";

type QuickLogMode = "manual" | "composed";

interface QuickLogPageProps {
  logDate: string;
  savedFoods: SavedFood[];
  isEditing?: boolean;
  initialEntry?: LogEntry;
  onBack: () => void;
  onConfirm: (payload: QuickLogPayload) => void | Promise<void>;
  onManageFoods?: () => void;
}

const slots: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function QuickLogPage({
  logDate,
  savedFoods,
  isEditing = false,
  initialEntry,
  onBack,
  onConfirm,
  onManageFoods,
}: QuickLogPageProps) {
  const [mode, setMode] = useState<QuickLogMode>("manual");
  const [name, setName] = useState(initialEntry?.name ?? "");
  const [slot, setSlot] = useState<MealSlot>(initialEntry?.slot ?? defaultMealSlot());
  const [calories, setCalories] = useState(String(initialEntry?.calories ?? ""));
  const [protein, setProtein] = useState(String(initialEntry?.protein ?? ""));
  const [carbs, setCarbs] = useState(String(initialEntry?.carbs ?? ""));
  const [fat, setFat] = useState(String(initialEntry?.fat ?? ""));
  const [components, setComponents] = useState<FoodComponentSelection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const composedTotals = useMemo(
    () => sumFoodComponents(savedFoods, components),
    [savedFoods, components],
  );

  const manualPayload: QuickLogPayload = {
    name,
    slot,
    calories: parseNonNegative(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  };

  const isManualValid = name.trim().length > 0 && manualPayload.calories > 0;
  const isComposedValid =
    name.trim().length > 0 && components.length > 0 && composedTotals.calories > 0;
  const isValid = isEditing
    ? isManualValid
    : mode === "manual"
      ? isManualValid
      : isComposedValid;

  const handleConfirm = async () => {
    if (!isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isEditing || mode === "manual") {
        await onConfirm(manualPayload);
      } else {
        await onConfirm({
          name: name.trim(),
          slot,
          ...composedTotals,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const subtitle = isEditing
    ? undefined
    : mode === "manual"
      ? "One-off item, not saved to library"
      : "Built from saved foods";

  return (
    <PageShell
      title={isEditing ? "Edit entry" : "Quick log"}
      subtitle={subtitle}
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid || isSaving}
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

        {!isEditing && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/4 p-1">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === "manual"
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setMode("composed")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === "composed"
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              From foods
            </button>
          </div>
        )}

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lunch bowl"
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

        {(isEditing || mode === "manual") && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories (kcal)">
                <DecimalInput
                  allowDecimal={false}
                  value={calories}
                  onChange={setCalories}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <Field label="Protein (g)">
                <DecimalInput value={protein} onChange={setProtein} placeholder="0" className={inputClass} />
              </Field>
              <Field label="Carbs (g)">
                <DecimalInput value={carbs} onChange={setCarbs} placeholder="0" className={inputClass} />
              </Field>
              <Field label="Fat (g)">
                <DecimalInput value={fat} onChange={setFat} placeholder="0" className={inputClass} />
              </Field>
            </div>
          </section>
        )}

        {!isEditing && mode === "composed" && (
          <FoodComposer
            savedFoods={savedFoods}
            components={components}
            onChange={setComponents}
            onManageFoods={onManageFoods}
          />
        )}

        {isValid && (
          <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Preview</h2>
            <MacroChips
              macros={
                !isEditing && mode === "composed" ? composedTotals : manualPayload
              }
              size="md"
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20 focus:bg-white/8";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
