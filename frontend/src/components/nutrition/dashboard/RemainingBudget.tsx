import type { MacroTotals } from "../../../types/nutrition";

interface RemainingBudgetProps {
  remaining: MacroTotals;
}

const items = [
  {
    key: "calories" as const,
    label: "Calories",
    shortLabel: "KCAL",
    unit: "",
    colorClass: "text-calorie",
    bgClass: "bg-calorie/10 border-calorie/20",
  },
  {
    key: "protein" as const,
    label: "Protein",
    shortLabel: "P",
    unit: "g",
    colorClass: "text-protein",
    bgClass: "bg-protein/10 border-protein/20",
  },
  {
    key: "carbs" as const,
    label: "Carbs",
    shortLabel: "C",
    unit: "g",
    colorClass: "text-carbs",
    bgClass: "bg-carbs/10 border-carbs/20",
  },
  {
    key: "fat" as const,
    label: "Fat",
    shortLabel: "F",
    unit: "g",
    colorClass: "text-fat",
    bgClass: "bg-fat/10 border-fat/20",
  },
];

export function RemainingBudget({ remaining }: RemainingBudgetProps) {
  return (
    <section aria-label="Remaining budget">
      <h2 className="mb-3 text-sm font-medium text-zinc-400">Remaining</h2>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ key, label, shortLabel, unit, colorClass, bgClass }) => {
          const value = remaining[key];
          const isOver = value < 0;
          const display = Math.abs(value);

          return (
            <div
              key={key}
              className={`flex flex-col items-center rounded-xl border px-2 py-3 ${
                isOver ? "border-rose-500/25 bg-rose-500/8" : bgClass
              }`}
            >
              <span
                className={`mb-2 text-xs font-bold uppercase tracking-widest ${
                  isOver ? "text-rose-400/90" : colorClass
                }`}
              >
                {shortLabel}
              </span>
              <span
                className={`text-lg font-bold tabular-nums leading-none ${
                  isOver ? "text-rose-400" : "text-white"
                }`}
              >
                {display}
                {unit && (
                  <span className="ml-0.5 text-xs font-semibold text-zinc-400">{unit}</span>
                )}
              </span>
              {isOver && (
                <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                  over
                </span>
              )}
              <span className="sr-only">
                {label}: {display}
                {unit} {isOver ? "over" : "remaining"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
