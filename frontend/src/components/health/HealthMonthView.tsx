import { ACTIVITY_TYPE_LABELS } from "../../data/mockHealth";
import { aggregateHealthMonth } from "../../lib/healthAggregates";
import {
  addMonths,
  formatMonthYear,
  isSameMonth,
  isToday,
  monthFromDateKey,
  parseDateKey,
} from "../../lib/dates";
import { bandFromRatio, BAND_STYLES } from "../../lib/healthColors";
import { PAGE_SHELL } from "../../lib/layout";
import { isFutureDate } from "../../lib/logLabels";
import type { ActivityType } from "../../types/health";
import { DateNav } from "../layout/DateNav";

interface HealthMonthViewProps {
  anchorDate: string;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HealthMonthView({
  anchorDate,
  onAnchorChange,
  onSelectDate,
}: HealthMonthViewProps) {
  const { year, month } = monthFromDateKey(anchorDate);
  const summary = aggregateHealthMonth(anchorDate);
  const stepGoal = summary.days.find((d) => isSameMonth(d.date, year, month))?.stepGoal ?? 10_000;

  const topActivities = (
    Object.entries(summary.activityByType) as [ActivityType, number][]
  )
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const inMonthDays = summary.days.filter((d) => {
    const [y, m] = d.date.split("-").map(Number);
    return y === year && m - 1 === month && !isFutureDate(d.date);
  });
  const totalModerate = inMonthDays.reduce((sum, d) => sum + d.moderateIntensityMin, 0);
  const totalVigorous = inMonthDays.reduce((sum, d) => sum + d.vigorousIntensityMin, 0);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatMonthYear(year, month)}
        sublabel="Monthly health summary"
        onPrev={() => onAnchorChange(addMonths(anchorDate, -1))}
        onNext={() => onAnchorChange(addMonths(anchorDate, 1))}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">👟 Total steps</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {(summary.totalSteps / 1000).toFixed(0)}k
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Daily average</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {summary.avgSteps.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">😴 Avg sleep</p>
          <p className="mt-1 text-lg font-bold text-white">{summary.avgSleepHours}h</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-lime-400">🏃 Workouts</p>
          <p className="mt-1 text-lg font-bold text-white">{summary.totalActivities}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">💪 Moderate min</p>
          <p className="mt-1 text-lg font-bold text-white">{totalModerate}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400">💪 Vigorous min</p>
          <p className="mt-1 text-lg font-bold text-white">{totalVigorous}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-1 text-center text-[10px] font-semibold uppercase text-zinc-600"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {summary.days.map((day) => {
            const inMonth = isSameMonth(day.date, year, month);
            const dayNum = parseDateKey(day.date).getDate();
            const band = day.steps > 0 ? bandFromRatio(day.steps, stepGoal) : null;
            const future = isFutureDate(day.date);
            const cellBg =
              !inMonth
                ? "bg-transparent"
                : future
                  ? "bg-zinc-800/20"
                  : band === null
                    ? "bg-zinc-800/40"
                    : band === "poor"
                      ? "bg-red-500/30"
                      : band === "fair"
                        ? "bg-orange-500/30"
                        : band === "good"
                          ? "bg-yellow-500/35"
                          : "bg-emerald-500/35";

            if (!inMonth) {
              return <div key={day.date} className="aspect-square" />;
            }

            if (future) {
              return (
                <div
                  key={day.date}
                  className={`aspect-square rounded-lg p-0.5 opacity-40 ${cellBg}`}
                  aria-hidden
                >
                  <CellContent dayNum={dayNum} isToday={false} steps={0} showSteps={false} />
                </div>
              );
            }

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`aspect-square rounded-lg p-0.5 transition hover:ring-1 hover:ring-white/20 ${cellBg} ${isToday(day.date) ? "ring-1 ring-sky-400/60" : ""}`}
              >
                <CellContent
                  dayNum={dayNum}
                  isToday={isToday(day.date)}
                  steps={day.steps}
                  showSteps={day.steps > 0}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px] text-zinc-500">
          <Legend swatch="bg-zinc-800/40" label="Rest" />
          <Legend swatch="bg-red-500/30" label="<50%" />
          <Legend swatch="bg-orange-500/30" label="50–75%" />
          <Legend swatch="bg-yellow-500/35" label="75–99%" />
          <Legend swatch="bg-emerald-500/35" label="≥100%" />
        </div>
      </div>

      {topActivities.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface-elevated/60 p-4">
          <p className="mb-3 text-sm font-medium text-zinc-400">Activity breakdown</p>
          <div className="space-y-2">
            {topActivities.map(([type, count]) => {
              const pct = Math.round((count / summary.totalActivities) * 100);
              const band = bandFromRatio(pct, 100);
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-zinc-400">
                    {ACTIVITY_TYPE_LABELS[type]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${BAND_STYLES[band].bg}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-zinc-300">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CellContent({
  dayNum,
  isToday: today,
  steps,
  showSteps,
}: {
  dayNum: number;
  isToday: boolean;
  steps: number;
  showSteps: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-0.5">
      <span
        className={`text-[11px] font-semibold ${today ? "text-sky-400" : "text-zinc-400"}`}
      >
        {dayNum}
      </span>
      {showSteps && (
        <span className="text-[8px] font-medium leading-none text-zinc-300">
          {(steps / 1000).toFixed(1)}k
        </span>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
