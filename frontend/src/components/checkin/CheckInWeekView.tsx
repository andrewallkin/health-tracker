import { useEffect, useState } from "react";
import { fetchCheckInsInRange } from "../../lib/api";
import { formatSevenDayAvgKg, sevenDayWeightAverageAsOf } from "../../lib/checkIn";
import { addDays, addWeeks, formatWeekRange, getWeekRange, toDateKey } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import type { CheckIn } from "../../types/health";
import { DateNav } from "../layout/DateNav";
import { CheckInWeightChart } from "./CheckInWeightChart";

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
  const rangeKey = `${start}:${end}`;
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loadedRange, setLoadedRange] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const from = addDays(start, -6);
    fetchCheckInsInRange(from, end)
      .then((loaded) => {
        if (!cancelled) {
          setCheckIns(loaded);
          setLoadedRange(rangeKey);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [start, end, rangeKey]);

  const displayCheckIns = loadedRange === rangeKey ? checkIns : [];
  const today = toDateKey();
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const weightByDate = new Map(
    displayCheckIns
      .filter((checkIn) => checkIn.weightKg !== null)
      .map((checkIn) => [checkIn.checkInDate, checkIn.weightKg as number]),
  );
  const weightDays = weekDates.map((date) => ({
    date,
    weight: weightByDate.get(date) ?? null,
    hasCheckIn: displayCheckIns.some((checkIn) => checkIn.checkInDate === date),
    avg: sevenDayWeightAverageAsOf(date, displayCheckIns, today),
  }));
  const loggedWeights = weightDays.filter((day) => day.weight !== null);
  const checkInDays = weightDays.filter((day) => day.hasCheckIn).length;
  const headlineDate = end > today ? today : end;
  const sundayAvg =
    start > today ? null : sevenDayWeightAverageAsOf(headlineDate, displayCheckIns, today);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatWeekRange(start, end)}
        sublabel="Weekly check-ins"
        onPrev={() => onAnchorChange(addWeeks(anchorDate, -1))}
        onNext={() => onAnchorChange(addWeeks(anchorDate, 1))}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <Stat label="Days logged" value={checkInDays} accent="text-teal-400" />
        <Stat
          label="Weights logged"
          value={loggedWeights.length}
          accent="text-sky-400"
        />
        <Stat
          label="7-day avg"
          value={sundayAvg ? `${formatSevenDayAvgKg(sundayAvg.averageKg)} kg` : "—"}
          accent="text-amber-400"
        />
      </div>

      {loggedWeights.length > 0 || weightDays.some((day) => day.avg) ? (
        <div className="rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
          <CheckInWeightChart
            days={weightDays.map((day) => ({
              date: day.date,
              weekday: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "narrow",
              }),
              weight: day.weight,
              avg: day.avg,
            }))}
            onSelectDate={onSelectDate}
          />
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
      <p className="mt-1 text-lg font-bold whitespace-nowrap tabular-nums text-white">{value}</p>
    </div>
  );
}
