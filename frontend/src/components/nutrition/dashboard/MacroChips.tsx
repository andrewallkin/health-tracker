import type { MacroTotals } from "../../../types/nutrition";

interface MacroChipsProps {
  macros: MacroTotals;
  size?: "sm" | "md";
}

export function MacroChips({ macros, size = "sm" }: MacroChipsProps) {
  const text = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded-lg bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-400 ${text}`}
      >
        {macros.calories} kcal
      </span>
      <MacroChip label="P" value={macros.protein} color="text-blue-400 bg-blue-500/15" text={text} />
      <MacroChip label="C" value={macros.carbs} color="text-green-400 bg-green-500/15" text={text} />
      <MacroChip label="F" value={macros.fat} color="text-rose-400 bg-rose-500/15" text={text} />
    </div>
  );
}

function MacroChip({
  label,
  value,
  color,
  text,
}: {
  label: string;
  value: number;
  color: string;
  text: string;
}) {
  return (
    <span className={`rounded-lg px-2 py-0.5 font-medium ${color} ${text}`}>
      {label} {value}g
    </span>
  );
}
