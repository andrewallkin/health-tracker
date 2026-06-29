import { useState, type ReactNode } from "react";
import { parseNonNegative, parsePositive } from "../../../lib/numericInput";
import type { NewSavedFoodPayload } from "../../../lib/savedFood";
import { FOOD_TAG_LABELS, FOOD_TAGS } from "../../../lib/foodTags";
import type { FoodTag, SavedFood } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";
import { MealPhotoPicker } from "../shared/MealPhotoPicker";
import { PageShell } from "../../layout/PageShell";
import { DecimalInput } from "../../shared/DecimalInput";

interface NewFoodPageProps {
  initialFood?: SavedFood;
  onBack: () => void;
  onSave: (payload: NewSavedFoodPayload, options?: { logToDay?: boolean }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

export function NewFoodPage({ initialFood, onBack, onSave, onDelete }: NewFoodPageProps) {
  const isEditing = Boolean(initialFood);
  const [name, setName] = useState(initialFood?.name ?? "");
  const [description, setDescription] = useState(initialFood?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialFood?.imageUrl);
  const [calories, setCalories] = useState(String(initialFood?.calories ?? ""));
  const [protein, setProtein] = useState(String(initialFood?.protein ?? ""));
  const [carbs, setCarbs] = useState(String(initialFood?.carbs ?? ""));
  const [fat, setFat] = useState(String(initialFood?.fat ?? ""));
  const [tags, setTags] = useState<FoodTag[]>(initialFood?.tags ?? []);
  const [logToDay, setLogToDay] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload: NewSavedFoodPayload = {
    name,
    description: description.trim() || undefined,
    imageUrl,
    calories: parsePositive(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
    tags: tags.length > 0 ? tags : undefined,
  };

  const isValid = name.trim().length > 0 && payload.calories > 0;

  const toggleTag = (tag: FoodTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(payload, !isEditing && logToDay ? { logToDay: true } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save food.");
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
      setError(err instanceof Error ? err.message : "Could not delete food.");
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDelete = () => {
    void handleDelete();
  };

  return (
    <PageShell
      title={isEditing ? "Edit food" : "New food"}
      subtitle="Save to library and log anytime"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid || isSaving || isDeleting}
            onClick={handleSave}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save food"}
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

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Greek yogurt"
            className={inputClass}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Per 100g · or one medium apple…"
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </Field>

        <MealPhotoPicker imageUrl={imageUrl} onChange={setImageUrl} />

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Tags (optional)</h2>
          <div className="flex flex-wrap gap-2">
            {FOOD_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  tags.includes(tag)
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                    : "border-white/10 bg-white/4 text-zinc-400 hover:border-white/20"
                }`}
              >
                {FOOD_TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Nutrition per portion</h2>
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

        {isValid && (
          <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Preview</h2>
            <MacroChips macros={payload} size="md" />
          </section>
        )}

        {!isEditing && (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
            <input
              type="checkbox"
              checked={logToDay}
              onChange={(e) => setLogToDay(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-amber-500"
            />
            <span className="text-sm text-zinc-300">Log to today after saving</span>
          </label>
        )}

        {isEditing && onDelete && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={isDeleting}
              onClick={requestDelete}
              className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Delete saved food"}
            </button>
          </div>
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
