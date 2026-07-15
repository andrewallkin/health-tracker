import { useState } from "react";
import { HRV_STATUS_LABELS } from "../../data/mockHealth";
import { formatHoursAsHm } from "../../lib/formatDuration";
import { getHealthDay } from "../../lib/healthAggregates";
import { addDays, formatDayHeader, isToday, toDateKey } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { isFutureDate } from "../../lib/logLabels";
import type { DailyHealth } from "../../types/health";
import { DateNav } from "../layout/DateNav";
import { HealthActivityList } from "./HealthActivityList";
import { HealthDetailModal, type HealthDetailRow } from "./HealthDetailModal";

type DetailKind = "sleep" | "hr" | "hrv";

interface HealthDayViewProps {
  selectedDate: string;
  onDateChange: (dateKey: string) => void;
}

export function HealthDayView({ selectedDate, onDateChange }: HealthDayViewProps) {
  const day = getHealthDay(selectedDate);
  const title = isToday(selectedDate) ? "Today" : formatDayHeader(selectedDate);
  const future = isFutureDate(selectedDate);
  const [detail, setDetail] = useState<DetailKind | null>(null);

  const hrvAccent =
    day?.hrvStatus === "low"
      ? "text-rose-400"
      : day?.hrvStatus === "high"
        ? "text-violet-400"
        : "text-emerald-400";

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={title}
        sublabel={isToday(selectedDate) ? formatDayHeader(selectedDate) : "Garmin health"}
        onPrev={() => onDateChange(addDays(selectedDate, -1))}
        onNext={() => onDateChange(addDays(selectedDate, 1))}
        onJumpToday={() => onDateChange(toDateKey())}
        showToday={!isToday(selectedDate)}
        disableNext={future}
      />

      {future ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">No health data for future dates</p>
        </div>
      ) : !day ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">No health data for this date</p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <MetricCard
              icon="👟"
              label="Steps"
              value={day.steps.toLocaleString()}
              detail={`Goal ${day.stepGoal.toLocaleString()}`}
              accent="text-sky-400"
            />
            <MetricCard
              icon="😴"
              label="Sleep"
              value={formatHoursAsHm(day.sleepHours)}
              detail={day.sleepScore !== null ? `Score ${day.sleepScore}` : undefined}
              accent="text-indigo-400"
              onClick={() => setDetail("sleep")}
            />
          </div>

          <div className="mb-3 rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base">🔥</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Calories burned
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Active
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {day.activeCalories}
                  <span className="ml-1 text-sm font-normal text-zinc-500">kcal</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">From movement & workouts</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Total
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {day.totalCalories}
                  <span className="ml-1 text-sm font-normal text-zinc-500">kcal</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {day.bmrCalories} resting + {day.activeCalories} active
                </p>
              </div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <MetricCard
              icon="💓"
              label="Resting HR"
              value={`${day.restingHr}`}
              unit="bpm"
              accent="text-rose-400"
              onClick={() => setDetail("hr")}
            />
            <MetricCard
              icon="📊"
              label="HRV"
              value={day.hrv !== null ? `${day.hrv}` : "—"}
              unit={day.hrv !== null ? "ms" : ""}
              detail={HRV_STATUS_LABELS[day.hrvStatus]}
              accent={hrvAccent}
              onClick={() => setDetail("hrv")}
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
              <span>🏃</span> Activities
            </h2>
            <span className="text-xs text-zinc-500">{day.activities.length} recorded</span>
          </div>
          <HealthActivityList activities={day.activities} />

          {detail && (
            <HealthDetailModal
              title={detailTitle(detail)}
              rows={detailRows(detail, day)}
              onClose={() => setDetail(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function detailTitle(kind: DetailKind): string {
  if (kind === "sleep") return "Sleep";
  if (kind === "hr") return "Resting heart rate";
  return "HRV";
}

function detailRows(kind: DetailKind, day: DailyHealth): HealthDetailRow[] {
  if (kind === "sleep") {
    return [
      { label: "Deep", value: formatHoursAsHm(day.deepSleepHours) },
      { label: "REM", value: formatHoursAsHm(day.remSleepHours) },
      { label: "Light", value: formatHoursAsHm(day.lightSleepHours) },
      { label: "Heart rate average", value: `${day.sleepAvgHr} bpm` },
    ];
  }
  if (kind === "hr") {
    return [
      { label: "Resting", value: `${day.restingHr} bpm` },
      { label: "Min", value: `${day.minHr} bpm` },
      { label: "Max", value: `${day.maxHr} bpm` },
      { label: "7-day avg resting", value: `${day.avgRestingHr7d} bpm` },
      { label: "Sleep avg", value: `${day.sleepAvgHr} bpm` },
    ];
  }
  return [
    { label: "Last night", value: day.hrv !== null ? `${day.hrv} ms` : "—" },
    { label: "Status", value: HRV_STATUS_LABELS[day.hrvStatus] },
    {
      label: "7-day moving average",
      value: day.hrvWeeklyAvg !== null ? `${day.hrvWeeklyAvg} ms` : "—",
    },
  ];
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  detail,
  accent,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  accent: string;
  onClick?: () => void;
}) {
  const className =
    "rounded-2xl border border-white/10 bg-surface-elevated/70 p-4 text-left transition";
  const interactive = onClick
    ? "hover:border-white/20 hover:bg-surface-elevated"
    : "";

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${accent}`}>{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>}
      </p>
      {detail && <p className={`mt-1 text-xs ${accent}`}>{detail}</p>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} ${interactive}`}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
