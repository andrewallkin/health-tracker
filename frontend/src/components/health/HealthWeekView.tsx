import { aggregateHealthWeek } from "../../lib/healthAggregates";
import { formatHoursAsHm, formatMinutesAsHm } from "../../lib/formatDuration";
import { bandFromRatio, bandFromSleepScore, BAND_STYLES } from "../../lib/healthColors";
import { useHealthWeek } from "../../hooks/useHealthData";
import { addWeeks, formatWeekRange, getWeekRange } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { DateNav } from "../layout/DateNav";
import { HealthWeekBarChart } from "./HealthWeekBarChart";
import { ProgressRing } from "./ProgressRing";

interface HealthWeekViewProps {
  anchorDate: string;
  onAnchorChange: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}

export function HealthWeekView({
  anchorDate,
  onAnchorChange,
  onSelectDate,
}: HealthWeekViewProps) {
  const { start, end } = getWeekRange(anchorDate);
  const { days, errors, loading, loadError, garminDisconnected } = useHealthWeek(anchorDate, true);
  const summary = aggregateHealthWeek(anchorDate, days);
  const stepGoal = summary.days.find((d) => d.steps > 0)?.stepGoal ?? 7000;
  const caloriesParts = Math.max(summary.avgBmrCalories + summary.avgActiveCalories, 1);
  const restingPct = (summary.avgBmrCalories / caloriesParts) * 100;
  const activePct = (summary.avgActiveCalories / caloriesParts) * 100;
  const maxTotalCalories = Math.max(...summary.days.map((d) => d.totalCalories), 1);
  const maxSleepHours = Math.max(...summary.days.map((d) => d.sleepHours), 1);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatWeekRange(start, end)}
        sublabel="Weekly health summary"
        onPrev={() => onAnchorChange(addWeeks(anchorDate, -1))}
        onNext={() => onAnchorChange(addWeeks(anchorDate, 1))}
      />

      {errors.length > 0 && (
        <p className="mb-3 text-xs text-amber-400/90">
          {errors.map((entry) => entry.message).join(" · ")}
        </p>
      )}

      {loading ? (
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
      ) : (
        <>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <StepsAvgCard
          steps={summary.avgSteps}
          stepGoal={stepGoal}
          daysAtGoal={summary.stepGoalDays}
        />
        <SleepAvgCard sleepHours={summary.avgSleepHours} sleepScore={summary.avgSleepScore} />
      </div>

      <div className="mb-3 rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
            Avg calories burned
          </p>
        </div>
        <p className="mt-3 text-3xl font-bold tracking-tight text-white">
          {summary.avgTotalCalories > 0 ? summary.avgTotalCalories.toLocaleString() : "—"}
          {summary.avgTotalCalories > 0 && (
            <span className="ml-1.5 text-base font-normal text-zinc-500">kcal</span>
          )}
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
              {summary.avgBmrCalories > 0 ? summary.avgBmrCalories.toLocaleString() : "—"}
              {summary.avgBmrCalories > 0 && (
                <span className="ml-1 text-xs font-normal text-zinc-500">kcal</span>
              )}
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
              {summary.avgActiveCalories > 0 ? summary.avgActiveCalories.toLocaleString() : "—"}
              {summary.avgActiveCalories > 0 && (
                <span className="ml-1 text-xs font-normal text-zinc-500">kcal</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
        <MiniStat
          emoji="💓"
          label="Avg resting HR"
          value={summary.avgRestingHr !== null ? String(summary.avgRestingHr) : "—"}
          unit={summary.avgRestingHr !== null ? "bpm" : undefined}
          accent="text-rose-400"
        />
        <MiniStat
          emoji="📊"
          label="Avg HRV"
          value={summary.avgHrv !== null ? String(summary.avgHrv) : "—"}
          unit={summary.avgHrv !== null ? "ms" : undefined}
          accent="text-emerald-400"
        />
        <MiniStat
          emoji="🏃"
          label="Workouts"
          value={
            summary.totalActivities > 0
              ? `${summary.totalActivities} · ${formatMinutesAsHm(summary.totalWorkoutMin)}`
              : "—"
          }
          accent="text-zinc-300"
        />
      </div>

      <HealthWeekBarChart
        title="Steps"
        emoji="👟"
        hint={`Goal ${stepGoal.toLocaleString()}`}
        days={summary.days}
        getValue={(d) => d.steps}
        getTarget={(d) => d.stepGoal}
        maxValue={stepGoal * 1.2}
        goalLine={stepGoal}
        formatBarLabel={(v) => `${(v / 1000).toFixed(1)}k`}
        onSelectDate={onSelectDate}
      />

      <HealthWeekBarChart
        title="Sleep"
        emoji="😴"
        days={summary.days}
        getValue={(d) => d.sleepHours}
        sleepDurationWithScorePip
        maxValue={Math.max(maxSleepHours * 1.1, 1)}
        formatBarLabel={(v) => formatHoursAsHm(v)}
        onSelectDate={onSelectDate}
      />

      <HealthWeekBarChart
        title="Calories"
        emoji="🔥"
        hint="Resting + active"
        days={summary.days}
        getValue={(d) => d.totalCalories}
        stackedCalories
        maxValue={maxTotalCalories * 1.05}
        formatBarLabel={(v) => `${Math.round(v / 100) / 10}k`}
        onSelectDate={onSelectDate}
      />
        </>
      )}
    </div>
  );
}

function StepsAvgCard({
  steps,
  stepGoal,
  daysAtGoal,
}: {
  steps: number;
  stepGoal: number;
  daysAtGoal: number;
}) {
  const band = BAND_STYLES[bandFromRatio(steps, stepGoal)];
  const progress = stepGoal > 0 ? Math.min(steps / stepGoal, 1) : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
      <div className="flex items-center justify-start gap-2 self-start">
        <span className="text-base">👟</span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Steps</p>
      </div>
      <div className="mt-3 flex flex-1 flex-col items-center justify-center">
        {steps > 0 ? (
          <ProgressRing progress={progress} stroke={band.stroke} size={96} strokeWidth={8}>
            <p className="text-center text-lg font-bold leading-tight text-white">
              {steps.toLocaleString()}
            </p>
          </ProgressRing>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/5">
            <span className="text-zinc-500">—</span>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          {daysAtGoal > 0
            ? `${daysAtGoal} day${daysAtGoal === 1 ? "" : "s"} at goal`
            : `Goal ${stepGoal.toLocaleString()}`}
        </p>
      </div>
    </div>
  );
}

function SleepAvgCard({
  sleepHours,
  sleepScore,
}: {
  sleepHours: number;
  sleepScore: number | null;
}) {
  const scoreProgress = sleepScore !== null ? Math.min(sleepScore / 100, 1) : 0;
  const scoreStroke =
    sleepScore !== null ? BAND_STYLES[bandFromSleepScore(sleepScore)].stroke : "#818cf8";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-surface-elevated/70 p-4">
      <div className="flex items-center justify-start gap-2 self-start">
        <span className="text-base">😴</span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Sleep</p>
      </div>

      <div className="mt-2 flex flex-1 flex-col items-center justify-center">
        {sleepScore !== null ? (
          <ProgressRing progress={scoreProgress} stroke={scoreStroke} size={96} strokeWidth={8}>
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
          {sleepHours > 0 ? formatHoursAsHm(sleepHours) : "—"}
        </p>
      </div>
    </div>
  );
}

function MiniStat({
  emoji,
  label,
  value,
  unit,
  accent,
}: {
  emoji: string;
  label: string;
  value: string;
  unit?: string;
  accent: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{emoji}</span>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${accent}`}>{label}</p>
      </div>
      <p className="mt-1 text-lg font-bold text-white">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span>}
      </p>
    </div>
  );
}
