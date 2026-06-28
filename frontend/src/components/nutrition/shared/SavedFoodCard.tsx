import type { SavedFood, FoodTag } from "../../../types/nutrition";
import { FOOD_TAG_LABELS } from "../../../lib/foodTags";
import { MacroChips } from "../dashboard/MacroChips";

interface SavedFoodCardProps {
  food: SavedFood;
  onEdit: (foodId: string) => void;
}

export function SavedFoodCard({ food, onEdit }: SavedFoodCardProps) {
  return (
    <button
      type="button"
      onClick={() => onEdit(food.id)}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-white/10 bg-white/4 p-3 text-left transition hover:border-white/20 hover:bg-white/6 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-zinc-100">{food.name}</h3>
        {food.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {food.description}
          </p>
        )}
        {(food.tags?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {food.tags!.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500"
              >
                {FOOD_TAG_LABELS[tag as FoodTag]}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2.5">
          <MacroChips
            macros={{
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
            }}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center self-center text-zinc-600">
        <ChevronIcon />
      </div>
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
