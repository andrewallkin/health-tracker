import { useEffect, useMemo, useState } from "react";
import { useHealthWeek } from "../../../hooks/useHealthData";
import { aggregateWeek, calorieHeatLevel, groupEntriesByDate } from "../../../lib/aggregates";
import { fetchDayStatusesInRange, fetchEntriesInRange } from "../../../lib/api";
import {
  addWeeks,
  formatWeekRange,
  getWeekRange,
  isToday,
  weekdayShort,
} from "../../../lib/dates";
import { rangeEnergyBalance } from "../../../lib/energyBalance";
import { PAGE_SHELL } from "../../../lib/layout";
import { isFutureDate } from "../../../lib/logLabels";
import type { DailyGoal, LogEntry } from "../../../types/nutrition";
import { DateNav } from "../../layout/DateNav";
import { EnergyBalanceCard } from "./EnergyBalanceCard";

interface WeekViewProps {
  anchorDate: string;
  goal: DailyGoal;
  entriesVersion: number;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}

export function WeekView({
  anchorDate,
  goal,
  entriesVersion,
  onAnchorChange,
  onSelectDate,
}: WeekViewProps) {
  const { start, end, dates } = getWeekRange(anchorDate);
  const fetchKey = `${start}:${end}:${entriesVersion}`;
  const [entriesByDate, setEntriesByDate] = useState<Map<string, LogEntry[]>>(new Map());
  const [notTrackedDates, setNotTrackedDates] = useState<Set<string>>(new Set());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchEntriesInRange(start, end), fetchDayStatusesInRange(start, end)])
      .then(([entries, statuses]) => {
        if (!cancelled) {
          setEntriesByDate(groupEntriesByDate(entries));
          setNotTrackedDates(new Set(statuses.map((s) => s.statusDate)));
          setLoadedKey(fetchKey);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [fetchKey, start, end]);

  const summary = useMemo(
    () => aggregateWeek(dates, goal, entriesByDate, notTrackedDates),
    [dates, goal, entriesByDate, notTrackedDates],
  );
  const health = useHealthWeek(anchorDate, true);
  const burnByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of health.days) {
      map.set(d.date, d.totalCalories);
    }
    return map;
  }, [health.days]);
  const balance = useMemo(
    () =>
      rangeEnergyBalance(summary.days, burnByDate, {
        loading: health.loading,
        garminDisconnected: health.garminDisconnected,
        loadError: health.loadError,
      }),
    [summary.days, burnByDate, health.loading, health.garminDisconnected, health.loadError],
  );
  const maxCalories = Math.max(
    goal.calories,
    ...summary.days.filter((d) => d.countsInAverages).map((d) => d.consumed.calories),
    1,
  );

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatWeekRange(start, end)}
        sublabel="Weekly summary"
        onPrev={() => onAnchorChange(addWeeks(anchorDate, -1))}
        onNext={() => onAnchorChange(addWeeks(anchorDate, 1))}
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Loading week…</p>
      ) : (
        <>
      <div className="mb-5 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <Stat label="Avg kcal" value={summary.averages.calories} accent="text-amber-400" />
        <Stat label="Avg P" value={`${summary.averages.protein}g`} accent="text-protein" />
        <Stat label="Avg C" value={`${summary.averages.carbs}g`} accent="text-carbs" />
        <Stat label="Avg F" value={`${summary.averages.fat}g`} accent="text-fat" />
      </div>

      <EnergyBalanceCard balance={balance} mode="average" />

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/4 p-5">
        <div className="mb-4 flex items-end justify-between">
          <p className="text-sm font-medium text-zinc-400">Daily calories</p>
          <p className="text-xs text-zinc-500">
            {summary.daysOnTarget} / {summary.daysLogged} days on target
          </p>
        </div>

        <div className="relative flex h-44 items-end justify-between gap-1.5">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-amber-500/40"
            style={{ bottom: `${(goal.calories / maxCalories) * 100}%` }}
          />
          {summary.days.map((day) => {
            const future = isFutureDate(day.date);
            const heightPct =
              day.countsInAverages && day.consumed.calories > 0
                ? (day.consumed.calories / maxCalories) * 100
                : 0;
            const heat = day.notTracked
              ? "none"
              : calorieHeatLevel(day.consumed.calories, goal.calories);
            const barColor =
              future
                ? "bg-zinc-800/20"
                : day.notTracked
                ? "bg-zinc-700/40"
                : heat === "none"
                ? "bg-zinc-700/40"
                : heat === "under"
                  ? "bg-emerald-500/70"
                  : heat === "near"
                    ? "bg-amber-500/80"
                    : "bg-rose-500/70";

            const calorieLabel = day.notTracked
              ? "N/T"
              : day.consumed.calories > 0
                ? String(day.consumed.calories)
                : "—";

            const bar = (
              <>
                <span
                  className={`text-[10px] font-medium text-zinc-500 ${
                    day.notTracked && !future ? "opacity-100" : "opacity-0 transition group-hover:opacity-100"
                  }`}
                >
                  {calorieLabel}
                </span>
                <div className="relative flex h-36 w-full items-end">
                  <div
                    className={`w-full rounded-t-md transition group-hover:opacity-90 ${barColor} ${isToday(day.date) ? "ring-1 ring-white/30" : ""}`}
                    style={{
                      height: `${Math.max(heightPct, day.countsInAverages ? 4 : 2)}%`,
                    }}
                  />
                </div>
                <span
                  className={`text-[11px] font-semibold ${isToday(day.date) ? "text-amber-400" : future ? "text-zinc-700" : "text-zinc-500"}`}
                >
                  {weekdayShort(day.date)}
                </span>
              </>
            );

            if (future) {
              return (
                <div
                  key={day.date}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2 opacity-50"
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

        <p className="mt-3 text-center text-[10px] text-zinc-600">
          Dashed line = {goal.calories} kcal goal · tap a day to open
        </p>
      </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
