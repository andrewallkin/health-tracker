import { useEffect, useState } from "react";
import { fetchCheckInsInRange } from "../../lib/api";
import {
  checkInMonthFetchRange,
  clampDatesFrom,
  firstWeightedDate,
  formatSevenDayAvgKg,
  sevenDayWeightAverageAsOf,
  toWeightChartDays,
} from "../../lib/checkIn";
import {
  addMonths,
  formatMonthYear,
  getMonthDates,
  monthFromDateKey,
  toDateKey,
  trailingDayDates,
} from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import type { CheckIn } from "../../types/health";
import { DateNav } from "../layout/DateNav";
import { CheckInWeightChart, type WeightChartDay } from "./CheckInWeightChart";

interface CheckInMonthViewProps {
  anchorDate: string;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}

export function CheckInMonthView({
  anchorDate,
  onAnchorChange,
  onSelectDate,
}: CheckInMonthViewProps) {
  const { year, month } = monthFromDateKey(anchorDate);
  const monthDates = getMonthDates(year, month);
  const monthStart = monthDates[0];
  const monthEnd = monthDates.at(-1)!;
  const today = toDateKey();
  const { from, to } = checkInMonthFetchRange(monthStart, monthEnd, today);
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
  const earliestWeight = firstWeightedDate(displayCheckIns);
  const monthChartDates = clampDatesFrom(
    monthDates.filter((date) => date <= today),
    earliestWeight,
  );
  const rollingChartDates = clampDatesFrom(trailingDayDates(today, 30), earliestWeight);
  const monthWeightDays = toWeightChartDays(monthChartDates, displayCheckIns, today);
  const rollingWeightDays = toWeightChartDays(rollingChartDates, displayCheckIns, today);
  const monthLoggedWeights = monthWeightDays.filter((day) => day.weight !== null);
  const rollingLoggedWeights = rollingWeightDays.filter((day) => day.weight !== null);
  const checkInDays = monthDates.filter((date) =>
    displayCheckIns.some((checkIn) => checkIn.checkInDate === date),
  ).length;
  const weightsLogged = monthDates.filter((date) =>
    displayCheckIns.some(
      (checkIn) => checkIn.checkInDate === date && checkIn.weightKg !== null,
    ),
  ).length;
  const headlineDate = monthEnd > today ? today : monthEnd;
  const monthAvg =
    monthStart > today ? null : sevenDayWeightAverageAsOf(headlineDate, displayCheckIns, today);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatMonthYear(year, month)}
        sublabel="Monthly check-ins"
        onPrev={() => onAnchorChange(addMonths(anchorDate, -1))}
        onNext={() => onAnchorChange(addMonths(anchorDate, 1))}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <Stat label="Days logged" value={checkInDays} accent="text-teal-400" />
        <Stat label="Weights logged" value={weightsLogged} accent="text-sky-400" />
        <Stat
          label="7-day avg"
          value={monthAvg ? `${formatSevenDayAvgKg(monthAvg.averageKg)} kg` : "—"}
          accent="text-amber-400"
        />
      </div>

      <div className="space-y-4">
        <WeightChartCard
          title="This month"
          days={monthWeightDays}
          hasWeights={monthLoggedWeights.length > 0 || monthWeightDays.some((day) => day.avg)}
          emptyLabel="No weights logged this month"
          onSelectDate={onSelectDate}
        />
        <WeightChartCard
          title="Last 30 days"
          days={rollingWeightDays}
          hasWeights={rollingLoggedWeights.length > 0 || rollingWeightDays.some((day) => day.avg)}
          emptyLabel="No weights logged in the last 30 days"
          onSelectDate={onSelectDate}
        />
      </div>
    </div>
  );
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
