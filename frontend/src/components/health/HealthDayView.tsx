import type { ReactNode } from "react";
import { HRV_STATUS_LABELS } from "../../data/mockHealth";
import { getHealthDay } from "../../lib/healthAggregates";
import { addDays, formatDayHeader, isToday, toDateKey } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { isFutureDate } from "../../lib/logLabels";
import { DateNav } from "../layout/DateNav";
import { HealthActivityList } from "./HealthActivityList";
import { HealthSparkChart } from "./HealthSparkChart";
import { TargetProgressBar } from "./TargetProgressBar";

const SLEEP_TARGET_HOURS = 8;

interface HealthDayViewProps {
  selectedDate: string;
  onDateChange: (dateKey: string) => void;
}

export function HealthDayView({ selectedDate, onDateChange }: HealthDayViewProps) {
  const day = getHealthDay(selectedDate);
  const title = isToday(selectedDate) ? "Today" : formatDayHeader(selectedDate);
  const future = isFutureDate(selectedDate);
  const hrvAccent =
    day.hrvStatus === "low"
      ? "text-rose-400"
      : day.hrvStatus === "high"
        ? "text-violet-400"
        : "text-emerald-400";

  const sleepDetail = [
    `${day.deepSleepHours}h deep`,
    day.sleepScore !== null ? `score ${day.sleepScore}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
      ) : (
        <>
          <div className="mb-5 space-y-5 rounded-2xl border border-white/10 bg-surface-elevated/80 p-5">
            <SummarySection emoji="👟" title="Steps">
              <p className="mb-3 text-3xl font-bold tracking-tight text-white">
                {day.steps.toLocaleString()}
              </p>
              <TargetProgressBar
                value={day.steps}
                target={day.stepGoal}
                label={`Goal ${day.stepGoal.toLocaleString()}`}
              />
            </SummarySection>

            <SummarySection emoji="😴" title="Sleep" detail={sleepDetail}>
              <p className="mb-3 text-3xl font-bold tracking-tight text-white">
                {day.sleepHours}
                <span className="ml-1.5 text-lg font-normal text-zinc-400">hours</span>
              </p>
              <TargetProgressBar
                value={day.sleepHours}
                target={SLEEP_TARGET_HOURS}
                label={`Goal ${SLEEP_TARGET_HOURS}h`}
              />
            </SummarySection>

            <SummarySection emoji="🔥" title="Calories burned">
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
            </SummarySection>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <MetricCard
              icon="💓"
              label="Resting HR"
              value={`${day.restingHr}`}
              unit="bpm"
              accent="text-rose-400"
            />
            <MetricCard
              icon="📊"
              label="HRV"
              value={day.hrv !== null ? `${day.hrv}` : "—"}
              unit={day.hrv !== null ? "ms" : ""}
              detail={HRV_STATUS_LABELS[day.hrvStatus]}
              accent={hrvAccent}
            />
            <MetricCard
              icon="😰"
              label="Stress"
              value={`${day.avgStress}`}
              unit="avg"
              detail={`Peak ${day.maxStress}`}
              accent="text-orange-400"
            />
            <MetricCard
              icon="🔋"
              label="Body battery"
              value={`${day.bodyBatteryLow}–${day.bodyBatteryHigh}`}
              unit=""
              detail={`+${day.bodyBatteryCharged} / −${day.bodyBatteryDrained}`}
              accent="text-lime-400"
            />
          </div>

          <div className="mb-5 space-y-3">
            <HealthSparkChart
              data={day.bodyBatteryCurve}
              emoji="🔋"
              label="Body battery"
              caption={`Low ${day.bodyBatteryLow} · High ${day.bodyBatteryHigh}`}
              color="#a3e635"
              fillColor="rgb(163 230 53 / 0.15)"
            />
            <HealthSparkChart
              data={day.stressCurve}
              emoji="😰"
              label="Stress"
              caption={`Avg ${day.avgStress} · Peak ${day.maxStress}`}
              color="#fb923c"
              fillColor="rgb(251 146 60 / 0.12)"
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
              <span>🏃</span> Activities
            </h2>
            <span className="text-xs text-zinc-500">{day.activities.length} recorded</span>
          </div>
          <HealthActivityList activities={day.activities} />
        </>
      )}
    </div>
  );
}

function SummarySection({
  emoji,
  title,
  detail,
  children,
}: {
  emoji: string;
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/10 pb-5 last:border-b-0 last:pb-0">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
          <span>{emoji}</span>
          {title}
        </p>
        {detail && <p className="text-right text-xs text-zinc-500">{detail}</p>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  detail,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  detail?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${accent}`}>{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>}
      </p>
      {detail && <p className={`mt-1 text-xs ${accent}`}>{detail}</p>}
    </div>
  );
}
