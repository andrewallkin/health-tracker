import { useEffect, useMemo, useState } from "react";
import { aggregateMonth, calorieHeatLevel, groupEntriesByDate } from "../../../lib/aggregates";
import { fetchEntriesInRange } from "../../../lib/api";
import {
  addMonths,
  formatMonthYear,
  getMonthGrid,
  isSameMonth,
  isToday,
  monthFromDateKey,
  parseDateKey,
} from "../../../lib/dates";
import { PAGE_SHELL } from "../../../lib/layout";
import { isFutureDate } from "../../../lib/logLabels";
import type { DailyGoal, LogEntry } from "../../../types/nutrition";
import { DateNav } from "../../layout/DateNav";

interface MonthViewProps {
  anchorDate: string;
  goal: DailyGoal;
  entriesVersion: number;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({
  anchorDate,
  goal,
  entriesVersion,
  onAnchorChange,
  onSelectDate,
}: MonthViewProps) {
  const { year, month } = monthFromDateKey(anchorDate);
  const gridDates = getMonthGrid(year, month);
  const rangeStart = gridDates[0];
  const rangeEnd = gridDates[gridDates.length - 1];
  const [entriesByDate, setEntriesByDate] = useState<Map<string, LogEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEntriesInRange(rangeStart, rangeEnd)
      .then((entries) => {
        if (!cancelled) setEntriesByDate(groupEntriesByDate(entries));
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, entriesVersion]);

  const summary = useMemo(
    () => aggregateMonth(year, month, goal, entriesByDate),
    [year, month, goal, entriesByDate],
  );

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatMonthYear(year, month)}
        sublabel="Monthly summary"
        onPrev={() => onAnchorChange(addMonths(anchorDate, -1))}
        onNext={() => onAnchorChange(addMonths(anchorDate, 1))}
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Loading month…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Days logged" value={String(summary.daysLogged)} />
            <StatCard label="On target" value={String(summary.daysOnTarget)} />
            <StatCard label="Avg kcal" value={String(summary.averages.calories)} />
            <StatCard label="Total kcal" value={String(summary.totals.calories)} />
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1 text-center text-xs font-medium text-zinc-500">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {summary.days.map((day) => {
              const inMonth = isSameMonth(day.date, year, month);
              const heat = calorieHeatLevel(day.consumed.calories, goal.calories);
              const future = isFutureDate(day.date);
              const today = isToday(day.date);

              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!inMonth || future}
                  onClick={() => onSelectDate(day.date)}
                  className={[
                    "flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition",
                    !inMonth && "invisible",
                    inMonth && !future && "hover:bg-white/8",
                    today && "ring-1 ring-amber-500/50",
                    heat === "none" && inMonth && "text-zinc-600",
                    heat === "under" && "bg-emerald-500/15 text-emerald-300",
                    heat === "near" && "bg-amber-500/15 text-amber-300",
                    heat === "over" && "bg-rose-500/15 text-rose-300",
                    future && "cursor-not-allowed opacity-40",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="font-medium">{parseDateKey(day.date).getDate()}</span>
                  {day.hasEntries && (
                    <span className="text-[10px] opacity-80">{day.consumed.calories}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
