import { useState } from "react";
import {
  HRV_STATUS_EMOJI,
  HRV_STATUS_LABELS,
  hrvStatusAccent,
} from "../../data/mockHealth";
import { formatHoursAsHm } from "../../lib/formatDuration";
import { bandFromRatio, bandFromSleepScore, BAND_STYLES } from "../../lib/healthColors";
import { useHealthDay } from "../../hooks/useHealthData";
import { addDays, formatDayHeader, isToday, toDateKey } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { isFutureDate } from "../../lib/logLabels";
import type { DailyHealth } from "../../types/health";
import { DateNav } from "../layout/DateNav";
import { HealthActivityList } from "./HealthActivityList";
import { HealthDetailModal, type HealthDetailRow } from "./HealthDetailModal";
import { ProgressRing } from "./ProgressRing";

type DetailKind = "sleep" | "hr" | "hrv";

interface HealthDayViewProps {
  selectedDate: string;
  onDateChange: (dateKey: string) => void;
}

export function HealthDayView({ selectedDate, onDateChange }: HealthDayViewProps) {
  const future = isFutureDate(selectedDate);
  const { day, errors, loading, loadError, garminDisconnected } = useHealthDay(
    selectedDate,
    !future,
  );
  const title = isToday(selectedDate) ? "Today" : formatDayHeader(selectedDate);
  const [detail, setDetail] = useState<DetailKind | null>(null);

  const hrvAccent = day ? hrvStatusAccent(day.hrvStatus) : "text-zinc-400";
  const activeDetail = detail && day ? detailMeta(detail, day) : null;

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

      {errors.length > 0 && (
        <p className="mb-3 text-xs text-amber-400/90">
          {errors.map((entry) => entry.message).join(" · ")}
        </p>
      )}

      {future ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">No health data for future dates</p>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">Loading health…</p>
        </div>
      ) : garminDisconnected ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">Connect Garmin in Settings</p>
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">{loadError}</p>
        </div>
      ) : !day ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
          <p className="text-sm text-zinc-500">No health data for this date</p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <StepsCard steps={day.steps} stepGoal={day.stepGoal} />
            <SleepCard
              sleepHours={day.sleepHours}
              sleepScore={day.sleepScore}
              onClick={() => setDetail("sleep")}
            />
          </div>

          <CaloriesCard
            totalCalories={day.totalCalories}
            activeCalories={day.activeCalories}
            bmrCalories={day.bmrCalories}
          />

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

          {activeDetail && detail && (
            <HealthDetailModal
              emoji={activeDetail.emoji}
              title={activeDetail.title}
              accent={activeDetail.accent}
              rows={detailRows(detail, day)}
              onClose={() => setDetail(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function detailMeta(
  kind: DetailKind,
  day: DailyHealth,
): { emoji: string; title: string; accent: string } {
  if (kind === "sleep") {
    return { emoji: "😴", title: "Sleep", accent: "text-indigo-400" };
  }
  if (kind === "hr") {
    return { emoji: "💓", title: "Resting heart rate", accent: "text-rose-400" };
  }
  return { emoji: "📊", title: "HRV", accent: hrvStatusAccent(day.hrvStatus) };
}

function detailRows(kind: DetailKind, day: DailyHealth): HealthDetailRow[] {
  if (kind === "sleep") {
    return [
      {
        emoji: "🌑",
        label: "Deep",
        value: formatHoursAsHm(day.deepSleepHours),
        accent: "text-indigo-400",
      },
      {
        emoji: "💭",
        label: "REM",
        value: formatHoursAsHm(day.remSleepHours),
        accent: "text-violet-400",
      },
      {
        emoji: "🌙",
        label: "Light",
        value: formatHoursAsHm(day.lightSleepHours),
        accent: "text-sky-400",
      },
      {
        emoji: "💓",
        label: "Heart rate average",
        value: `${day.sleepAvgHr} bpm`,
        accent: "text-rose-400",
      },
    ];
  }
  if (kind === "hr") {
    return [
      {
        emoji: "🧘",
        label: "Resting",
        value: `${day.restingHr} bpm`,
        accent: "text-rose-400",
      },
      {
        emoji: "⬇️",
        label: "Min",
        value: `${day.minHr} bpm`,
        accent: "text-sky-400",
      },
      {
        emoji: "⬆️",
        label: "Max",
        value: `${day.maxHr} bpm`,
        accent: "text-orange-400",
      },
      {
        emoji: "📅",
        label: "7-day avg resting",
        value: `${day.avgRestingHr7d} bpm`,
        accent: "text-amber-400",
      },
      {
        emoji: "😴",
        label: "Sleep avg",
        value: `${day.sleepAvgHr} bpm`,
        accent: "text-indigo-400",
      },
    ];
  }

  const statusAccent = hrvStatusAccent(day.hrvStatus);

  return [
    {
      emoji: "🌙",
      label: "Last night",
      value: day.hrv !== null ? `${day.hrv} ms` : "—",
      accent: statusAccent,
    },
    {
      emoji: HRV_STATUS_EMOJI[day.hrvStatus],
      label: "Status",
      value: HRV_STATUS_LABELS[day.hrvStatus],
      accent: statusAccent,
    },
    {
      emoji: "📈",
      label: "7-day moving average",
      value: day.hrvWeeklyAvg !== null ? `${day.hrvWeeklyAvg} ms` : "—",
      accent: "text-sky-400",
    },
  ];
}

function CaloriesCard({
  totalCalories,
  activeCalories,
  bmrCalories,
}: {
  totalCalories: number;
  activeCalories: number;
  bmrCalories: number;
}) {
  const partsTotal = Math.max(bmrCalories + activeCalories, 1);
  const restingPct = (bmrCalories / partsTotal) * 100;
  const activePct = (activeCalories / partsTotal) * 100;

  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🔥</span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
          Calories burned
        </p>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight text-white">
        {totalCalories.toLocaleString()}
        <span className="ml-1.5 text-base font-normal text-zinc-500">kcal</span>
      </p>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${restingPct}%` }}
          title="Resting"
        />
        <div
          className="h-full bg-rose-500 transition-all duration-500"
          style={{ width: `${activePct}%` }}
          title="Active"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
              Resting
            </p>
          </div>
          <p className="mt-1 text-lg font-bold text-white">
            {bmrCalories.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-zinc-500">kcal</span>
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
              Active
            </p>
          </div>
          <p className="mt-1 text-lg font-bold text-white">
            {activeCalories.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-zinc-500">kcal</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function StepsCard({ steps, stepGoal }: { steps: number; stepGoal: number }) {
  const band = BAND_STYLES[bandFromRatio(steps, stepGoal)];
  const progress = stepGoal > 0 ? Math.min(steps / stepGoal, 1) : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
      <div className="flex items-center justify-start gap-2 self-start">
        <span className="text-base">👟</span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Steps</p>
      </div>
      <div className="mt-3 flex flex-1 flex-col items-center justify-center">
        <ProgressRing
          progress={progress}
          stroke={band.stroke}
          size={96}
          strokeWidth={8}
        >
          <p className="text-center text-lg font-bold leading-tight text-white">
            {steps.toLocaleString()}
          </p>
        </ProgressRing>
        <p className="mt-2 text-xs text-zinc-500">
          Goal {stepGoal.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function SleepCard({
  sleepHours,
  sleepScore,
  onClick,
}: {
  sleepHours: number;
  sleepScore: number | null;
  onClick: () => void;
}) {
  const scoreProgress = sleepScore !== null ? Math.min(sleepScore / 100, 1) : 0;
  const scoreStroke = sleepScore !== null
    ? BAND_STYLES[bandFromSleepScore(sleepScore)].stroke
    : "#818cf8";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col rounded-2xl border border-white/10 bg-surface-elevated/70 p-4 text-left transition hover:border-white/20 hover:bg-surface-elevated"
    >
      <div className="flex items-center justify-start gap-2 self-start">
        <span className="text-base">😴</span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Sleep</p>
      </div>

      <div className="mt-2 flex flex-1 flex-col items-center justify-center">
        {sleepScore !== null ? (
          <ProgressRing
            progress={scoreProgress}
            stroke={scoreStroke}
            size={96}
            strokeWidth={8}
          >
            <div className="text-center">
              <p className="text-2xl font-bold leading-none text-white">{sleepScore}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
                Score
              </p>
            </div>
          </ProgressRing>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/5">
            <span className="text-zinc-500">—</span>
          </div>
        )}
        <p className="mt-3 text-2xl font-bold tracking-tight text-white">
          {formatHoursAsHm(sleepHours)}
        </p>
      </div>
    </button>
  );
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
