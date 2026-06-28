import { useMemo, useState } from "react";

import { foodMatchesTagFilter } from "../../../lib/foodTags";
import type { FoodTag, SavedFood, SavedMeal } from "../../../types/nutrition";
import { FOOD_TAG_LABELS, FOOD_TAGS } from "../../../lib/foodTags";
import { PageShell } from "../../layout/PageShell";
import { SavedFoodCard } from "../shared/SavedFoodCard";
import { SavedMealCard } from "../shared/SavedMealCard";

type LibraryTab = "meals" | "foods";

interface SavedMealsPageProps {
  meals: SavedMeal[];
  foods: SavedFood[];
  initialTab?: LibraryTab;
  onBack: () => void;
  onCreateNewMeal: () => void;
  onCreateNewFood: () => void;
  onSelectMeal: (mealId: string) => void;
  onEditMeal: (mealId: string) => void;
  onEditFood: (foodId: string) => void;
}

export function SavedMealsPage({
  meals,
  foods,
  initialTab = "foods",
  onBack,
  onCreateNewMeal,
  onCreateNewFood,
  onSelectMeal,
  onEditMeal,
  onEditFood,
}: SavedMealsPageProps) {
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<FoodTag | null>(null);

  const filteredMeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter(
      (meal) =>
        meal.name.toLowerCase().includes(q) ||
        meal.description?.toLowerCase().includes(q),
    );
  }, [meals, query]);

  const filteredFoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods.filter((food) => {
      if (!foodMatchesTagFilter(food.tags, tagFilter)) return false;
      if (!q) return true;
      return (
        food.name.toLowerCase().includes(q) ||
        food.description?.toLowerCase().includes(q)
      );
    });
  }, [foods, query, tagFilter]);

  const isMealsTab = tab === "meals";

  return (
    <PageShell title="Library" subtitle="Meals and reusable foods" onBack={onBack}>
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/4 p-1">
        <TabButton active={!isMealsTab} label="Foods" onClick={() => setTab("foods")} />
        <TabButton active={isMealsTab} label="Meals" onClick={() => setTab("meals")} />
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-3 pl-9 text-base text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20 focus:bg-white/8"
          />
        </div>
        <button
          type="button"
          onClick={isMealsTab ? onCreateNewMeal : onCreateNewFood}
          className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2.5 text-sm font-medium text-amber-400 transition hover:bg-amber-500/25"
        >
          + New
        </button>
      </div>

      {!isMealsTab && (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip label="All" active={tagFilter === null} onClick={() => setTagFilter(null)} />
          {FOOD_TAGS.map((tag) => (
            <FilterChip
              key={tag}
              label={FOOD_TAG_LABELS[tag]}
              active={tagFilter === tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {isMealsTab ? (
          filteredMeals.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No meals match your search.</p>
          ) : (
            filteredMeals.map((meal) => (
              <SavedMealCard
                key={meal.id}
                meal={meal}
                onSelect={onSelectMeal}
                onEdit={onEditMeal}
              />
            ))
          )
        ) : filteredFoods.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No foods match your search.</p>
        ) : (
          filteredFoods.map((food) => (
            <SavedFoodCard key={food.id} food={food} onEdit={onEditFood} />
          ))
        )}
      </div>
    </PageShell>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg py-2 text-sm font-medium transition ${
        active
          ? "bg-amber-500/20 text-amber-400"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({
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

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
