import { heatClassFromRatio, styleForCeiling } from "../../lib/healthColors";
import { isToday, weekdayShort } from "../../lib/dates";
import { isFutureDate } from "../../lib/logLabels";
import type { DailyHealth } from "../../types/health";

interface HealthWeekBarChartProps {
  title: string;
  emoji?: string;
  hint?: string;
  days: DailyHealth[];
  getValue: (day: DailyHealth) => number;
  getTarget: (day: DailyHealth) => number;
  /** When true, lower values vs target are better (stress). */
  lowerIsBetter?: boolean;
  maxValue: number;
  goalLine?: number;
  formatBarLabel: (value: number) => string;
  onSelectDate: (dateKey: string) => void;
}

export function HealthWeekBarChart({
  title,
  emoji,
  hint,
  days,
  getValue,
  getTarget,
  lowerIsBetter = false,
  maxValue,
  goalLine,
  formatBarLabel,
  onSelectDate,
}: HealthWeekBarChartProps) {
  const scaleMax = Math.max(maxValue, goalLine ?? 0, ...days.map(getValue), 1);

  function barColor(day: DailyHealth): string {
    const value = getValue(day);
    const target = getTarget(day);
    if (lowerIsBetter) {
      return styleForCeiling(value, target).bg;
    }
    return heatClassFromRatio(value, target);
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/4 p-5">
      <div className="mb-4 flex items-end justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          {emoji && <span>{emoji}</span>}
          {title}
        </p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>

      <div className="relative flex h-40 items-end justify-between gap-1.5">
        {goalLine !== undefined && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25"
            style={{ bottom: `${(goalLine / scaleMax) * 100}%` }}
          />
        )}
        {days.map((day) => {
          const value = getValue(day);
          const heightPct = (value / scaleMax) * 100;
          const future = isFutureDate(day.date);
          const colorClass = future ? "bg-zinc-800/25" : barColor(day);

          const bar = (
            <>
              <span className="text-[10px] font-medium text-zinc-500 opacity-0 transition group-hover:opacity-100">
                {value > 0 ? formatBarLabel(value) : "—"}
              </span>
              <div className="relative flex h-32 w-full items-end">
                <div
                  className={`w-full rounded-t-md transition group-hover:opacity-90 ${colorClass} ${isToday(day.date) ? "ring-1 ring-white/30" : ""}`}
                  style={{ height: `${Math.max(heightPct, value > 0 ? 6 : 2)}%` }}
                />
              </div>
              <span
                className={`text-[11px] font-semibold ${isToday(day.date) ? "text-sky-400" : future ? "text-zinc-700" : "text-zinc-500"}`}
              >
                {weekdayShort(day.date)}
              </span>
            </>
          );

          if (future) {
            return (
              <div
                key={day.date}
                className="flex min-w-0 flex-1 flex-col items-center gap-2 opacity-40"
                aria-hidden
              >
                {bar}
              </div>
            );
          }

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              {bar}
            </button>
          );
        })}
      </div>
    </div>
  );
}
