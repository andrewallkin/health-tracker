import { useState, type ReactNode } from "react";
import { addToDayLabel, confirmLogLabel } from "../../../lib/logLabels";
import { parseNonNegative, parsePositive } from "../../../lib/numericInput";
import { defaultMealSlot } from "../../../lib/quickLog";
import type {
  DescribeFoodInput,
  FoodEstimate,
  ReviewConfirmOptions,
  ReviewedFoodPayload,
} from "../../../types/foodEstimate";
import type { MealSlot, FoodTag } from "../../../types/nutrition";
import { FOOD_TAG_LABELS, FOOD_TAGS } from "../../../lib/foodTags";
import { MacroChips } from "../dashboard/MacroChips";
import { MealPhotoView } from "../shared/MealPhotoView";
import { PageShell } from "../../layout/PageShell";
import { DecimalInput } from "../../shared/DecimalInput";

interface EstimateReviewPageProps {
  input: DescribeFoodInput;
  estimate: FoodEstimate;
  logDate: string;
  onBack: () => void;
  onConfirm: (payload: ReviewedFoodPayload, options: ReviewConfirmOptions) => void | Promise<void>;
}

const slots: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function EstimateReviewPage({
  input,
  estimate,
  logDate,
  onBack,
  onConfirm,
}: EstimateReviewPageProps) {
  const [name, setName] = useState(estimate.name);
  const [slot, setSlot] = useState<MealSlot>(defaultMealSlot());
  const [calories, setCalories] = useState(String(estimate.calories_kcal));
  const [protein, setProtein] = useState(String(estimate.macros_g.protein));
  const [carbs, setCarbs] = useState(String(estimate.macros_g.carbs));
  const [fat, setFat] = useState(String(estimate.macros_g.fat));
  const [addToDay, setAddToDay] = useState(true);
  const [saveAsMeal, setSaveAsMeal] = useState(false);
  const [saveAsFood, setSaveAsFood] = useState(false);
  const [foodTags, setFoodTags] = useState<FoodTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload: ReviewedFoodPayload = {
    name,
    slot,
    calories: parsePositive(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
    description: input.note.trim() || undefined,
    imageUrl: input.photoUrl,
  };

  const isValid = name.trim().length > 0 && payload.calories > 0;
  const canConfirm = isValid && (addToDay || saveAsMeal || saveAsFood);

  const toggleFoodTag = (tag: FoodTag) => {
    setFoodTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(payload, { addToDay, saveAsMeal, saveAsFood, foodTags });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      title="Review estimate"
      subtitle="Edit before logging or saving"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!canConfirm || isSaving}
            onClick={handleConfirm}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : confirmLogLabel(addToDay, saveAsMeal, saveAsFood, logDate)}
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

        {input.photoUrl && <MealPhotoView src={input.photoUrl} alt="Meal" />}

        {isValid && (
          <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Preview</h2>
            <MacroChips macros={payload} size="md" />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories (kcal)">
              <DecimalInput
                allowDecimal={false}
                value={calories}
                onChange={setCalories}
                className={inputClass}
              />
            </Field>
            <Field label="Protein (g)">
              <DecimalInput value={protein} onChange={setProtein} className={inputClass} />
            </Field>
            <Field label="Carbs (g)">
              <DecimalInput value={carbs} onChange={setCarbs} className={inputClass} />
            </Field>
            <Field label="Fat (g)">
              <DecimalInput value={fat} onChange={setFat} className={inputClass} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <h2 className="mb-2 text-base font-medium text-zinc-100">{estimate.name}</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge
              label={estimate.source === "label" ? "From label" : "Estimated"}
              color={estimate.source === "label" ? "text-green-400 bg-green-500/15" : "text-amber-400 bg-amber-500/15"}
            />
            <Badge
              label={`${estimate.confidence} confidence`}
              color={confidenceColor(estimate.confidence)}
            />
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{estimate.summary}</p>
          {estimate.assumptions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {estimate.assumptions.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-zinc-500">
                  <span className="text-zinc-600">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="mb-2 text-xs font-medium text-zinc-500">What should we do?</p>
          <div className="space-y-2">
            <ToggleOption
              checked={addToDay}
              onChange={setAddToDay}
              label={addToDayLabel(logDate)}
              description={`Log as ${slot}`}
            />
            <ToggleOption
              checked={saveAsMeal}
              onChange={setSaveAsMeal}
              label="Save as meal"
              description="Reuse this combination later"
            />
            <ToggleOption
              checked={saveAsFood}
              onChange={setSaveAsFood}
              label="Save as food"
              description="Add to your food library"
            />
          </div>
          {saveAsFood && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {FOOD_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleFoodTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    foodTags.includes(tag)
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                      : "border-white/10 bg-white/4 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {FOOD_TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function ToggleOption({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        checked
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-white/10 bg-white/4 hover:border-white/20"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          checked ? "border-amber-500 bg-amber-500 text-zinc-900" : "border-white/20 bg-transparent"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span>
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        <span className="block text-xs text-zinc-500">{description}</span>
      </span>
    </button>
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${color}`}>
      {label}
    </span>
  );
}

function confidenceColor(confidence: FoodEstimate["confidence"]): string {
  if (confidence === "high") return "text-green-400 bg-green-500/15";
  if (confidence === "medium") return "text-amber-400 bg-amber-500/15";
  return "text-rose-400 bg-rose-500/15";
}
