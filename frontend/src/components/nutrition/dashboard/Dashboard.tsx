import { getDailySummary } from "../../../data/mock";
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
  onDateChange: (dateKey: string) => void;
  onOpenSettings: () => void;
  onDeleteEntry: (id: string) => void;
  onEditEntry: (id: string) => void;
}

export function Dashboard({
  selectedDate,
  entries,
  goal,
  onDateChange,
  onOpenSettings,
  onDeleteEntry,
  onEditEntry,
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

      <div className="mb-5 rounded-2xl border border-white/10 bg-surface-elevated/80 p-5 backdrop-blur-sm">
        <CalorieRing consumed={summary.consumed.calories} goal={summary.goal.calories} />
      </div>

      <div className="mb-5">
        <RemainingBudget remaining={summary.remaining} />
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-5">
        <MacroBars consumed={summary.consumed} goal={summary.goal} />
      </div>

      <MealList entries={entries} onDeleteEntry={onDeleteEntry} onEditEntry={onEditEntry} />
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l-.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
