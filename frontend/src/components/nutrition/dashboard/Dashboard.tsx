import { getDailySummary } from "../../../lib/aggregates";
import { addDays, formatDayHeader, isToday, toDateKey } from "../../../lib/dates";
import { PAGE_SHELL } from "../../../lib/layout";
import { isFutureDate } from "../../../lib/logLabels";
import type { DailyGoal, LogEntry } from "../../../types/nutrition";
import { CalorieRing } from "./CalorieRing";
import { DateNav } from "../../layout/DateNav";
import { MacroBars } from "./MacroBars";
import { MealList } from "./MealList";
import { RemainingBudget } from "./RemainingBudget";

interface DashboardProps {
  selectedDate: string;
  entries: LogEntry[];
  goal: DailyGoal;
  deleteError?: string | null;
  onDismissDeleteError?: () => void;
  onDateChange: (dateKey: string) => void;
  onDeleteEntry: (id: string) => void;
  onEditEntry: (id: string) => void;
  onAddFood?: () => void;
  onOpenLibrary?: () => void;
}

export function Dashboard({
  selectedDate,
  entries,
  goal,
  deleteError,
  onDismissDeleteError,
  onDateChange,
  onDeleteEntry,
  onEditEntry,
  onAddFood,
  onOpenLibrary,
}: DashboardProps) {
  const summary = getDailySummary(entries, goal);
  const title = isToday(selectedDate) ? "Today" : formatDayHeader(selectedDate);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={title}
        sublabel={isToday(selectedDate) ? formatDayHeader(selectedDate) : undefined}
        onPrev={() => onDateChange(addDays(selectedDate, -1))}
        onNext={() => onDateChange(addDays(selectedDate, 1))}
        disableNext={isFutureDate(addDays(selectedDate, 1))}
        onJumpToday={() => onDateChange(toDateKey())}
        showToday={!isToday(selectedDate)}
      />

      <div className="mb-5 rounded-2xl border border-white/10 bg-surface-elevated/80 p-5 backdrop-blur-sm">
        <CalorieRing consumed={summary.consumed.calories} goal={summary.goal.calories} />
      </div>

      <div className="mb-5">
        <RemainingBudget remaining={summary.remaining} />
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/4 p-5">
        <MacroBars consumed={summary.consumed} goal={summary.goal} />
      </div>

      {onAddFood && (
        <button
          type="button"
          onClick={onAddFood}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/20 transition hover:bg-amber-400 active:scale-[0.99]"
        >
          <PlusIcon />
          Add food
        </button>
      )}

      {onOpenLibrary && (
        <button
          type="button"
          onClick={onOpenLibrary}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/6 active:scale-[0.99]"
        >
          Library
        </button>
      )}

      {deleteError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          <span>{deleteError}</span>
          {onDismissDeleteError && (
            <button
              type="button"
              onClick={onDismissDeleteError}
              className="shrink-0 text-rose-400/80 transition hover:text-rose-200"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}

      <MealList entries={entries} onDeleteEntry={onDeleteEntry} onEditEntry={onEditEntry} />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
