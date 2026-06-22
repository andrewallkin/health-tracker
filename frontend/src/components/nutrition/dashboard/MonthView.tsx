import { aggregateMonth, calorieHeatLevel } from "../../../lib/aggregates";
import {
  addMonths,
  formatMonthYear,
  isSameMonth,
  isToday,
  monthFromDateKey,
  parseDateKey,
} from "../../../lib/dates";
import { PAGE_SHELL } from "../../../lib/layout";
import { isFutureDate } from "../../../lib/logLabels";
import type { DailyGoal } from "../../../types/nutrition";
import { DateNav } from "../../layout/DateNav";

interface MonthViewProps {
  anchorDate: string;
  goal: DailyGoal;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
  onOpenSettings: () => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({
  anchorDate,
  goal,
  onAnchorChange,
  onSelectDate,
  onOpenSettings,
}: MonthViewProps) {
  const { year, month } = monthFromDateKey(anchorDate);
  const summary = aggregateMonth(year, month, goal);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatMonthYear(year, month)}
        sublabel="Monthly summary"
        onPrev={() => onAnchorChange(addMonths(anchorDate, -1))}
        onNext={() => onAnchorChange(addMonths(anchorDate, 1))}
        trailing={
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Daily goals"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <GearIcon />
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Total kcal</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.totals.calories.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Daily average</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.averages.calories}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-protein">Avg protein</p>
          <p className="mt-1 text-lg font-bold text-white">{summary.averages.protein}g</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Days logged</p>
          <p className="mt-1 text-lg font-bold text-white">
            {summary.daysLogged}{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({summary.daysOnTarget} on target)
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase text-zinc-600">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {summary.days.map((day) => {
            const inMonth = isSameMonth(day.date, year, month);
            const dayNum = parseDateKey(day.date).getDate();
            const heat = calorieHeatLevel(day.consumed.calories, goal.calories);
            const future = isFutureDate(day.date);
            const cellBg =
              !inMonth
                ? "bg-transparent"
                : future
                  ? "bg-zinc-800/20"
                : heat === "none"
                  ? "bg-zinc-800/40"
                  : heat === "under"
                    ? "bg-emerald-500/25"
                    : heat === "near"
                      ? "bg-amber-500/30"
                      : "bg-rose-500/30";

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
                  <div className="flex h-full flex-col items-center justify-center gap-0.5">
                    <span className="text-[11px] font-semibold text-zinc-600">{dayNum}</span>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`aspect-square rounded-lg p-0.5 transition hover:ring-1 hover:ring-white/20 ${cellBg} ${isToday(day.date) ? "ring-1 ring-amber-400/60" : ""}`}
              >
                <div className="flex h-full flex-col items-center justify-center gap-0.5">
                  <span
                    className={`text-[11px] font-semibold ${isToday(day.date) ? "text-amber-400" : "text-zinc-400"}`}
                  >
                    {dayNum}
                  </span>
                  {day.hasEntries && (
                    <span className="text-[9px] font-medium leading-none text-zinc-300">
                      {day.consumed.calories}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px] text-zinc-500">
          <Legend swatch="bg-zinc-800/40" label="No log" />
          <Legend swatch="bg-emerald-500/25" label="Under" />
          <Legend swatch="bg-amber-500/30" label="On target" />
          <Legend swatch="bg-rose-500/30" label="Over" />
        </div>
      </div>
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

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l-.15-.09a2 2 0 0 0-.73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
