import type { CheckIn } from "../../types/health";
import { addDays, formatDayHeader, isToday, toDateKey } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { isFutureDate } from "../../lib/logLabels";
import { DateNav } from "../layout/DateNav";
import { CheckInCard } from "../health/CheckInCard";

interface CheckInDayViewProps {
  selectedDate: string;
  checkIn: CheckIn | null;
  checkInLoading?: boolean;
  checkInLoadError?: string | null;
  deleteCheckInError?: string | null;
  isDeletingCheckIn?: boolean;
  onDateChange: (dateKey: string) => void;
  onAddCheckIn: () => void;
  onEditCheckIn: () => void;
  onDeleteCheckIn: () => void;
  onDismissDeleteCheckInError?: () => void;
}

export function CheckInDayView({
  selectedDate,
  checkIn,
  checkInLoading = false,
  checkInLoadError = null,
  deleteCheckInError = null,
  isDeletingCheckIn = false,
  onDateChange,
  onAddCheckIn,
  onEditCheckIn,
  onDeleteCheckIn,
  onDismissDeleteCheckInError,
}: CheckInDayViewProps) {
  const title = isToday(selectedDate) ? "Today" : formatDayHeader(selectedDate);
  const future = isFutureDate(selectedDate);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={title}
        sublabel={isToday(selectedDate) ? formatDayHeader(selectedDate) : "Daily check-in"}
        onPrev={() => onDateChange(addDays(selectedDate, -1))}
        onNext={() => onDateChange(addDays(selectedDate, 1))}
        onJumpToday={() => onDateChange(toDateKey())}
        showToday={!isToday(selectedDate)}
        disableNext={future}
      />

      {future ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">No check-ins for future dates</p>
        </div>
      ) : (
        <>
          {deleteCheckInError && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
              <p className="text-sm text-rose-300">{deleteCheckInError}</p>
              {onDismissDeleteCheckInError && (
                <button
                  type="button"
                  onClick={onDismissDeleteCheckInError}
                  className="shrink-0 text-xs font-medium text-rose-200"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {checkInLoadError && (
            <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
              <p className="text-sm text-rose-300">{checkInLoadError}</p>
              <p className="mt-1 text-xs text-rose-200/70">
                If this persists, run database migrations on the backend.
              </p>
            </div>
          )}

          {checkInLoading ? (
            <div className="rounded-2xl border border-white/10 bg-surface-elevated/80 px-4 py-16 text-center">
              <p className="text-sm text-zinc-500">Loading check-in…</p>
            </div>
          ) : checkIn ? (
            <CheckInCard
              checkIn={checkIn}
              onEdit={onEditCheckIn}
              onDelete={onDeleteCheckIn}
              isDeleting={isDeletingCheckIn}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated/50 px-4 py-16 text-center">
              <p className="mb-4 text-sm text-zinc-500">No check-in yet</p>
              <button
                type="button"
                onClick={onAddCheckIn}
                className="rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-teal-400"
              >
                Add check-in
              </button>
            </div>
          )}

          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10 flex justify-center px-4">
            <button
              type="button"
              onClick={onAddCheckIn}
              className="pointer-events-auto flex w-full max-w-[448px] items-center justify-center gap-2 rounded-full bg-teal-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-teal-400 active:scale-[0.98]"
            >
              {checkIn ? "Edit check-in" : "Check in"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
