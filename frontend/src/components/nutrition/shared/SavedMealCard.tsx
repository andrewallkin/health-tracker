import type { SavedMeal } from "../../../types/nutrition";
import { MacroChips } from "../dashboard/MacroChips";

interface SavedMealCardProps {
  meal: SavedMeal;
  onSelect: (mealId: string) => void;
}

export function SavedMealCard({ meal, onSelect }: SavedMealCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(meal.id)}
      className="w-full rounded-2xl border border-white/10 bg-white/4 text-left transition hover:border-white/20 hover:bg-white/6 active:scale-[0.99]"
    >
      <div className="flex gap-3 p-3">
        <MealThumbnail name={meal.name} imageUrl={meal.imageUrl} />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="font-medium text-zinc-100">{meal.name}</h3>
          {meal.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
              {meal.description}
            </p>
          )}
          <div className="mt-2.5">
            <MacroChips
              macros={{
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fat: meal.fat,
              }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center text-zinc-600">
          <ChevronIcon />
        </div>
      </div>
    </button>
  );
}

function MealThumbnail({ name, imageUrl }: { name: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="h-20 w-20 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/4">
      <span className="text-2xl opacity-40">🍽</span>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
