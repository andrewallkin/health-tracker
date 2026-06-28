import { useMemo, useState } from "react";

import type { FoodComponentSelection } from "../../../lib/composeFoods";
import { sumFoodComponents } from "../../../lib/composeFoods";
import { FOOD_TAG_LABELS, FOOD_TAGS, foodMatchesTagFilter } from "../../../lib/foodTags";
import type { FoodTag, SavedFood } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";

interface FoodComposerProps {
  savedFoods: SavedFood[];
  components: FoodComponentSelection[];
  onChange: (components: FoodComponentSelection[]) => void;
  onManageFoods?: () => void;
}

export function FoodComposer({
  savedFoods,
  components,
  onChange,
  onManageFoods,
}: FoodComposerProps) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<FoodTag | null>(null);

  const totals = useMemo(
    () => sumFoodComponents(savedFoods, components),
    [savedFoods, components],
  );

  const availableFoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    return savedFoods.filter((food) => {
      if (!foodMatchesTagFilter(food.tags, tagFilter)) return false;
      if (!q) return true;
      return (
        food.name.toLowerCase().includes(q) ||
        food.description?.toLowerCase().includes(q)
      );
    });
  }, [savedFoods, query, tagFilter]);

  const componentFoods = useMemo(() => {
    const byId = new Map(savedFoods.map((food) => [food.id, food]));
    return components
      .map((component) => ({
        component,
        food: byId.get(component.foodId),
      }))
      .filter((row) => row.food !== undefined) as {
      component: FoodComponentSelection;
      food: SavedFood;
    }[];
  }, [components, savedFoods]);

  const addFood = (foodId: string) => {
    if (components.some((c) => c.foodId === foodId)) return;
    onChange([...components, { foodId, quantity: 1 }]);
  };

  const updateQuantity = (foodId: string, quantity: number) => {
    onChange(
      components.map((component) =>
        component.foodId === foodId ? { ...component, quantity } : component,
      ),
    );
  };

  const removeFood = (foodId: string) => {
    onChange(components.filter((component) => component.foodId !== foodId));
  };

  if (savedFoods.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/3 px-4 py-8 text-center">
        <p className="text-sm text-zinc-400">No saved foods yet.</p>
        {onManageFoods && (
          <button
            type="button"
            onClick={onManageFoods}
            className="mt-3 text-sm font-medium text-amber-400 underline underline-offset-2"
          >
            Add foods to your library
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {componentFoods.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-400">Your plate</h2>
          {componentFoods.map(({ component, food }) => (
            <div
              key={component.foodId}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{food.name}</p>
                <p className="text-xs text-zinc-500">
                  {Math.round(food.calories * component.quantity)} kcal
                </p>
              </div>
              <QuantityStepper
                value={component.quantity}
                onChange={(quantity) => updateQuantity(component.foodId, quantity)}
              />
              <button
                type="button"
                onClick={() => removeFood(component.foodId)}
                aria-label={`Remove ${food.name}`}
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-rose-400"
              >
                <RemoveIcon />
              </button>
            </div>
          ))}
          <div className="rounded-xl border border-white/10 bg-white/4 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-500">Total</p>
            <MacroChips macros={totals} size="md" />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-400">Add foods</h2>
          {onManageFoods && (
            <button
              type="button"
              onClick={onManageFoods}
              className="text-xs font-medium text-amber-400 underline underline-offset-2"
            >
              Manage foods
            </button>
          )}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search saved foods…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20"
        />

        <div className="flex flex-wrap gap-2">
          <TagChip
            label="All"
            active={tagFilter === null}
            onClick={() => setTagFilter(null)}
          />
          {FOOD_TAGS.map((tag) => (
            <TagChip
              key={tag}
              label={FOOD_TAG_LABELS[tag]}
              active={tagFilter === tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            />
          ))}
        </div>

        <div className="max-h-48 space-y-1 overflow-y-auto">
          {availableFoods.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">No foods match.</p>
          ) : (
            availableFoods.map((food) => {
              const added = components.some((c) => c.foodId === food.id);
              return (
                <button
                  key={food.id}
                  type="button"
                  disabled={added}
                  onClick={() => addFood(food.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-left transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="text-sm text-zinc-100">{food.name}</span>
                  <span className="text-xs text-zinc-500">{food.calories} kcal</span>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const step = (delta: number) => {
    const next = Math.round((value + delta) * 2) / 2;
    if (next >= 0.5) onChange(next);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => step(-0.5)}
        className="px-2 py-1 text-zinc-400 hover:text-zinc-100"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-[2rem] text-center text-sm text-zinc-100">{value}</span>
      <button
        type="button"
        onClick={() => step(0.5)}
        className="px-2 py-1 text-zinc-400 hover:text-zinc-100"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function TagChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
          : "border-white/10 bg-white/4 text-zinc-400 hover:border-white/20"
      }`}
    >
      {label}
    </button>
  );
}

function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}