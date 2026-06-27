import { useEffect, useState } from "react";
import { fetchCheckInsInRange } from "../../lib/api";
import { addDays, addWeeks, formatWeekRange, getWeekRange } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import type { CheckIn } from "../../types/health";
import { DateNav } from "../layout/DateNav";

interface CheckInWeekViewProps {
  anchorDate: string;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}

export function CheckInWeekView({
  anchorDate,
  onAnchorChange,
  onSelectDate,
}: CheckInWeekViewProps) {
  const { start, end } = getWeekRange(anchorDate);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchCheckInsInRange(start, end)
      .then((loaded) => {
        if (!cancelled) setCheckIns(loaded);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const weightByDate = new Map(
    checkIns
      .filter((checkIn) => checkIn.weightKg !== null)
      .map((checkIn) => [checkIn.checkInDate, checkIn.weightKg as number]),
  );
  const weightDays = weekDates.map((date) => ({
    date,
    weight: weightByDate.get(date) ?? null,
    hasCheckIn: checkIns.some((checkIn) => checkIn.checkInDate === date),
  }));
  const loggedWeights = weightDays.filter((day) => day.weight !== null);
  const weightValues = loggedWeights.map((day) => day.weight as number);
  const minWeight = weightValues.length > 0 ? Math.min(...weightValues) : 0;
  const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : 100;
  const weightRange = Math.max(maxWeight - minWeight, 1);
  const checkInDays = weightDays.filter((day) => day.hasCheckIn).length;

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatWeekRange(start, end)}
        sublabel="Weekly check-ins"
        onPrev={() => onAnchorChange(addWeeks(anchorDate, -1))}
        onNext={() => onAnchorChange(addWeeks(anchorDate, 1))}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <Stat label="Days logged" value={checkInDays} accent="text-teal-400" />
        <Stat
          label="Weights logged"
          value={loggedWeights.length}
          accent="text-sky-400"
        />
      </div>

      {loggedWeights.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
          <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
            <span>⚖️</span> Weight
          </p>
          <div className="grid grid-cols-7 gap-2">
            {weightDays.map((day) => {
              const label = new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "narrow",
              });
              const ratio =
                day.weight !== null ? (day.weight - minWeight) / weightRange : 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onSelectDate(day.date)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-1 py-2 transition hover:border-white/20"
                >
                  <span className="text-[10px] font-semibold uppercase text-zinc-500">{label}</span>
                  <div className="flex h-16 w-full items-end justify-center rounded-lg bg-white/5 px-1 pb-1">
                    {day.weight !== null ? (
                      <div
                        className="w-full max-w-[20px] rounded-t bg-teal-400/80"
                        style={{ height: `${Math.max(ratio * 100, 12)}%` }}
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-600">—</span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-zinc-300">
                    {day.weight !== null ? `${day.weight}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">No weights logged this week</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${accent}`}>{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
