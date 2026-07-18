import {
  bandFromSleepScore,
  BAND_STYLES,
  styleForCeiling,
  styleForRatio,
} from "../../lib/healthColors";
import { isToday, weekdayShort } from "../../lib/dates";
import { isFutureDate } from "../../lib/logLabels";
import type { DailyHealth } from "../../types/health";

/** Indigo matching the Sleep label / day-view fallback ring. */
const SLEEP_BAR_FILL = "#818cf8";

interface HealthWeekBarChartProps {
  title: string;
  emoji?: string;
  hint?: string;
  days: DailyHealth[];
  getValue: (day: DailyHealth) => number;
  getTarget?: (day: DailyHealth) => number;
  /** When true, lower values vs target are better (stress). */
  lowerIsBetter?: boolean;
  /**
   * Sleep mode: solid indigo bars (height = duration) plus a score-coloured
   * pip under each bar when a sleep score exists.
   */
  sleepDurationWithScorePip?: boolean;
  /** Stack each bar as resting (blue) + active (rose), height by total. */
  stackedCalories?: boolean;
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
  sleepDurationWithScorePip = false,
  stackedCalories = false,
  maxValue,
  goalLine,
  formatBarLabel,
  onSelectDate,
}: HealthWeekBarChartProps) {
  const scaleMax = Math.max(maxValue, goalLine ?? 0, ...days.map(getValue), 1);

  function barFill(day: DailyHealth): string {
    if (sleepDurationWithScorePip) {
      return SLEEP_BAR_FILL;
    }
    const value = getValue(day);
    const target = getTarget?.(day);
    if (target === undefined || target <= 0) {
      return SLEEP_BAR_FILL;
    }
    if (lowerIsBetter) {
      return styleForCeiling(value, target).stroke;
    }
    return styleForRatio(value, target).stroke;
  }

  return (
    <div className="mb-4 overflow-visible rounded-2xl border border-white/10 bg-surface-elevated/70 p-5">
      <div className="relative z-0 mb-3 flex items-end justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          {emoji && <span>{emoji}</span>}
          {title}
        </p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>

      <div className="relative z-10 flex h-56 items-end justify-between gap-1.5 pt-6">
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
          const barHeight = `${Math.max(heightPct, value > 0 ? 6 : 2)}%`;

          const partsTotal = Math.max(day.bmrCalories + day.activeCalories, 1);
          const restingPct = (day.bmrCalories / partsTotal) * 100;
          const activePct = (day.activeCalories / partsTotal) * 100;

          const scorePipColor =
            sleepDurationWithScorePip && day.sleepScore !== null
              ? BAND_STYLES[bandFromSleepScore(day.sleepScore)].stroke
              : null;

          const hoverLabel =
            value > 0
              ? sleepDurationWithScorePip && day.sleepScore !== null
                ? `${formatBarLabel(value)} · ${day.sleepScore}`
                : formatBarLabel(value)
              : "—";

          const barBody = stackedCalories ? (
            <div
              className={`flex w-full flex-col justify-end overflow-hidden rounded-t-md transition group-hover:opacity-90 ${isToday(day.date) ? "ring-1 ring-white/30" : ""}`}
              style={{ height: barHeight }}
            >
              {future || value <= 0 ? (
                <div className="h-full w-full bg-zinc-800/25" />
              ) : (
                <>
                  <div
                    className="w-full bg-rose-500"
                    style={{ height: `${activePct}%` }}
                    title="Active"
                  />
                  <div
                    className="w-full bg-blue-500"
                    style={{ height: `${restingPct}%` }}
                    title="Resting"
                  />
                </>
              )}
            </div>
          ) : (
            <div
              className={`w-full rounded-t-md transition group-hover:opacity-90 ${isToday(day.date) ? "ring-1 ring-white/30" : ""}`}
              style={{
                height: barHeight,
                backgroundColor: future ? "rgb(39 39 42 / 0.25)" : barFill(day),
              }}
            />
          );

          const bar = (
            <>
              <div className="relative w-full">
                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100">
                  {hoverLabel}
                </span>
                <div className="relative flex h-44 w-full items-end">{barBody}</div>
              </div>
              {sleepDurationWithScorePip && (
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: future
                      ? "rgb(63 63 70)"
                      : (scorePipColor ?? "rgb(63 63 70)"),
                  }}
                  title={
                    day.sleepScore !== null ? `Score ${day.sleepScore}` : "No score"
                  }
                  aria-hidden
                />
              )}
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
              className="group relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1.5 hover:z-20"
            >
              {bar}
            </button>
          );
        })}
      </div>
    </div>
  );
}
