import { useEffect, useState } from "react";
import { fetchCheckInsInRange } from "../../lib/api";
import {
  checkInWeekFetchRange,
  formatSevenDayAvgKg,
  sevenDayWeightAverageAsOf,
} from "../../lib/checkIn";
import { addWeeks, formatWeekRange, getWeekRange, toDateKey, trailingSevenDayDates } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import type { CheckIn } from "../../types/health";
import { DateNav } from "../layout/DateNav";
import { CheckInWeightChart, type WeightChartDay } from "./CheckInWeightChart";

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
  const { start, end, dates: weekDates } = getWeekRange(anchorDate);
  const today = toDateKey();
  const { from, to } = checkInWeekFetchRange(start, end, today);
  const rangeKey = `${from}:${to}`;
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loadedRange, setLoadedRange] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCheckInsInRange(from, to)
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
  }, [from, to, rangeKey]);

  const displayCheckIns = loadedRange === rangeKey ? checkIns : [];
  const weightDays = toWeightChartDays(weekDates, displayCheckIns, today);
  const rollingDays = toWeightChartDays(trailingSevenDayDates(today), displayCheckIns, today);
  const loggedWeights = weightDays.filter((day) => day.weight !== null);
  const rollingLoggedWeights = rollingDays.filter((day) => day.weight !== null);
  const checkInDays = weekDates.filter((date) =>
    displayCheckIns.some((checkIn) => checkIn.checkInDate === date),
  ).length;
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

      <div className="space-y-4">
        <WeightChartCard
          title="This week"
          days={weightDays}
          hasWeights={loggedWeights.length > 0 || weightDays.some((day) => day.avg)}
          emptyLabel="No weights logged this week"
          onSelectDate={onSelectDate}
        />
        <WeightChartCard
          title="Last 7 days"
          days={rollingDays}
          hasWeights={rollingLoggedWeights.length > 0 || rollingDays.some((day) => day.avg)}
          emptyLabel="No weights logged in the last 7 days"
          onSelectDate={onSelectDate}
        />
      </div>
    </div>
  );
}

function toWeightChartDays(
  dates: string[],
  checkIns: CheckIn[],
  today: string,
): WeightChartDay[] {
  const weightByDate = new Map(
    checkIns
      .filter((checkIn) => checkIn.weightKg !== null)
      .map((checkIn) => [checkIn.checkInDate, checkIn.weightKg as number]),
  );
  return dates.map((date) => ({
    date,
    weekday: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "narrow",
    }),
    weight: weightByDate.get(date) ?? null,
    avg: sevenDayWeightAverageAsOf(date, checkIns, today),
  }));
}

function WeightChartCard({
  title,
  days,
  hasWeights,
  emptyLabel,
  onSelectDate,
}: {
  title: string;
  days: WeightChartDay[];
  hasWeights: boolean;
  emptyLabel: string;
  onSelectDate: (dateKey: string) => void;
}) {
  if (!hasWeights) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
      <CheckInWeightChart days={days} title={title} onSelectDate={onSelectDate} />
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
