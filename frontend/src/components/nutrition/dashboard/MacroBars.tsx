import type { DailyGoal, MacroTotals } from "../../../types/nutrition";

interface MacroBarsProps {
  consumed: MacroTotals;
  goal: DailyGoal;
}

const macros = [
  { key: "protein" as const, label: "Protein", color: "var(--color-protein)" },
  { key: "carbs" as const, label: "Carbs", color: "var(--color-carbs)" },
  { key: "fat" as const, label: "Fat", color: "var(--color-fat)" },
];

export function MacroBars({ consumed, goal }: MacroBarsProps) {
  return (
    <div className="grid gap-3">
      {macros.map(({ key, label, color }) => {
        const value = consumed[key];
        const target = goal[key];
        const percent = Math.min(value / target, 1);

        return (
          <div key={key}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium text-zinc-300">{label}</span>
              <span className="text-zinc-500">
                <span className="font-semibold text-zinc-200">{value}g</span>
                {" / "}
                {target}g
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${percent * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
