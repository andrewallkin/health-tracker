import { useConfirm } from "../../../context/useConfirm";
import { useHealthDay } from "../../../hooks/useHealthData";
import { getDailySummary } from "../../../lib/aggregates";
import { addDays, formatDayHeader, isToday, toDateKey } from "../../../lib/dates";
import { dayEnergyBalance } from "../../../lib/energyBalance";
import { PAGE_SHELL } from "../../../lib/layout";
import { isFutureDate } from "../../../lib/logLabels";
import type { DailyGoal, LogEntry } from "../../../types/nutrition";
import { CalorieRing } from "./CalorieRing";
import { DateNav } from "../../layout/DateNav";
import { EnergyBalanceCard } from "./EnergyBalanceCard";
import { MacroBars } from "./MacroBars";
import { MealList } from "./MealList";
import { RemainingBudget } from "./RemainingBudget";

interface DashboardProps {
  selectedDate: string;
  entries: LogEntry[];
  goal: DailyGoal;
  isNotTracked: boolean;
  deleteError?: string | null;
  onDismissDeleteError?: () => void;
  onDateChange: (dateKey: string) => void;
  onDeleteEntry: (id: string) => void;
  onEditEntry: (id: string) => void;
  onMarkNotTracked: () => Promise<void>;
  onUnmarkNotTracked: () => Promise<void>;
  onAddFood?: () => void;
  onOpenLibrary?: () => void;
}

export function Dashboard({
  selectedDate,
  entries,
  goal,
  isNotTracked,
  deleteError,
  onDismissDeleteError,
  onDateChange,
  onDeleteEntry,
  onEditEntry,
  onMarkNotTracked,
  onUnmarkNotTracked,
  onAddFood,
  onOpenLibrary,
}: DashboardProps) {
  const confirm = useConfirm();
  const summary = getDailySummary(entries, goal);
  const health = useHealthDay(selectedDate, true);
  const balance = dayEnergyBalance(summary.consumed.calories, health.day?.totalCalories, {
    loading: health.loading,
    garminDisconnected: health.garminDisconnected,
    loadError: health.loadError,
  });
  const title = isToday(selectedDate) ? "Today" : formatDayHeader(selectedDate);
  const future = isFutureDate(selectedDate);

  const handleToggleTracked = async () => {
    if (isNotTracked) {
      const ok = await confirm({
        title: "Include this day?",
        message: "This day will count toward week and month averages again.",
        confirmLabel: "Include day",
      });
      if (!ok) return;
      await onUnmarkNotTracked();
      return;
    }

    const ok = await confirm({
      title: "Exclude this day?",
      message: "This day will be left out of week and month averages. Logged food stays visible.",
      confirmLabel: "Exclude day",
    });
    if (!ok) return;
    await onMarkNotTracked();
  };

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
        {isNotTracked && (
          <p className="mb-3 text-center text-xs font-medium text-zinc-500">
            Excluded from week &amp; month averages
          </p>
        )}
        <CalorieRing consumed={summary.consumed.calories} goal={summary.goal.calories} />
        {!future && (
          <div className="mt-4 flex justify-center border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={() => void handleToggleTracked()}
              className="text-xs font-medium text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline"
            >
              {isNotTracked ? "Include in averages" : "Exclude from averages"}
            </button>
          </div>
        )}
      </div>

      <EnergyBalanceCard balance={balance} mode="day" />

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
