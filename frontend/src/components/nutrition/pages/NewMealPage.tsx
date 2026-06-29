import { useMemo, useState, type ReactNode } from "react";
import {
  componentsToMealItems,
  type FoodComponentSelection,
} from "../../../lib/composeFoods";
import { sumFoodComponents } from "../../../lib/composeFoods";
import { parseNonNegative, parsePositive } from "../../../lib/numericInput";
import type { NewSavedMealPayload } from "../../../lib/savedMeal";
import type { SavedFood, SavedMeal } from "../../../types/nutrition";
import { useConfirm } from "../../../context/useConfirm";
import { MacroChips } from "../dashboard/MacroChips";
import { FoodComposer } from "../shared/FoodComposer";
import { MealPhotoPicker } from "../shared/MealPhotoPicker";
import { PageShell } from "../../layout/PageShell";
import { DecimalInput } from "../../shared/DecimalInput";

type MealMode = "manual" | "composed";

interface NewMealPageProps {
  savedFoods: SavedFood[];
  initialMeal?: SavedMeal;
  onBack: () => void;
  onSave: (payload: NewSavedMealPayload) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onManageFoods?: () => void;
}

export function NewMealPage({
  savedFoods,
  initialMeal,
  onBack,
  onSave,
  onDelete,
  onManageFoods,
}: NewMealPageProps) {
  const confirm = useConfirm();
  const isEditing = Boolean(initialMeal);
  const initialMode: MealMode =
    initialMeal?.kind === "composed" ? "composed" : "manual";

  const [mode, setMode] = useState<MealMode>(initialMode);
  const [name, setName] = useState(initialMeal?.name ?? "");
  const [description, setDescription] = useState(initialMeal?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialMeal?.imageUrl);
  const [calories, setCalories] = useState(String(initialMeal?.calories ?? ""));
  const [protein, setProtein] = useState(String(initialMeal?.protein ?? ""));
  const [carbs, setCarbs] = useState(String(initialMeal?.carbs ?? ""));
  const [fat, setFat] = useState(String(initialMeal?.fat ?? ""));
  const [components, setComponents] = useState<FoodComponentSelection[]>(() =>
    initialMeal?.kind === "composed"
      ? initialMeal.items.map((item) => ({
          foodId: item.foodId,
          quantity: item.quantity,
        }))
      : [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const composedTotals = useMemo(
    () => sumFoodComponents(savedFoods, components),
    [savedFoods, components],
  );

  const manualPayload: NewSavedMealPayload = {
    name,
    description: description.trim() || undefined,
    imageUrl,
    calories: parsePositive(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  };

  const isManualValid = name.trim().length > 0 && manualPayload.calories! > 0;
  const isComposedValid =
    name.trim().length > 0 && components.length > 0 && composedTotals.calories > 0;
  const isValid = mode === "manual" ? isManualValid : isComposedValid;

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      if (mode === "manual") {
        await onSave(manualPayload);
      } else {
        await onSave({
          name: name.trim(),
          description: description.trim() || undefined,
          imageUrl,
          items: componentsToMealItems(components),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save meal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete meal.");
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDelete = () => {
    void (async () => {
      const ok = await confirm({
        title: "Delete saved meal?",
        message:
          "Past log entries will stay but will no longer link to this meal.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (ok) await handleDelete();
    })();
  };

  return (
    <PageShell
      title={isEditing ? "Edit meal" : "New meal"}
      subtitle="Save to your library for quick logging"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid || isSaving || isDeleting}
            onClick={handleSave}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save meal"}
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
          <ModeToggle mode={mode} onChange={setMode} />
        )}

        {isEditing && initialMeal?.kind === "composed" && (
          <p className="text-xs text-zinc-500">Composed meal — edit foods below.</p>
        )}

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken, rice, and vegetables"
            className={inputClass}
          />
        </Field>

        <MealPhotoPicker imageUrl={imageUrl} onChange={setImageUrl} />

        {mode === "manual" && (
          <>
            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One serving · grilled chicken, ½ cup rice…"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <section>
              <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition per serving</h2>
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

            {isManualValid && (
              <PreviewSection
                macros={{
                  calories: manualPayload.calories!,
                  protein: manualPayload.protein!,
                  carbs: manualPayload.carbs!,
                  fat: manualPayload.fat!,
                }}
              />
            )}
          </>
        )}

        {mode === "composed" && (
          <>
            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Weekday lunch prep, serves 1…"
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <FoodComposer
              savedFoods={savedFoods}
              components={components}
              onChange={setComponents}
              onManageFoods={onManageFoods}
            />

            {isComposedValid && <PreviewSection macros={composedTotals} />}
          </>
        )}

        {isEditing && onDelete && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={isDeleting}
              onClick={requestDelete}
              className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Delete saved meal"}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: MealMode;
  onChange: (mode: MealMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/4 p-1">
      <button
        type="button"
        onClick={() => onChange("manual")}
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
        onClick={() => onChange("composed")}
        className={`rounded-lg py-2 text-sm font-medium transition ${
          mode === "composed"
            ? "bg-amber-500/20 text-amber-400"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        From foods
      </button>
    </div>
  );
}

function PreviewSection({
  macros,
}: {
  macros: { calories: number; protein: number; carbs: number; fat: number };
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-400">Preview</h2>
      <MacroChips macros={macros} size="md" />
    </section>
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
