import { useMemo, useState } from "react";
import type { SavedMeal } from "../../../types/nutrition";
import { PageShell } from "../../layout/PageShell";
import { SavedMealCard } from "../shared/SavedMealCard";

interface SavedMealsPageProps {
  meals: SavedMeal[];
  onBack: () => void;
  onCreateNew: () => void;
  onSelectMeal: (mealId: string) => void;
}

export function SavedMealsPage({
  meals,
  onBack,
  onCreateNew,
  onSelectMeal,
}: SavedMealsPageProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter(
      (meal) =>
        meal.name.toLowerCase().includes(q) ||
        meal.description?.toLowerCase().includes(q),
    );
  }, [meals, query]);

  return (
    <PageShell title="Add food" subtitle="Choose a saved meal" onBack={onBack}>
      <div className="mb-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meals…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-3 pl-9 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20 focus:bg-white/8"
          />
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2.5 text-sm font-medium text-amber-400 transition hover:bg-amber-500/25"
        >
          + New
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No meals match your search.</p>
        ) : (
          filtered.map((meal) => (
            <SavedMealCard key={meal.id} meal={meal} onSelect={onSelectMeal} />
          ))
        )}
      </div>
    </PageShell>
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
