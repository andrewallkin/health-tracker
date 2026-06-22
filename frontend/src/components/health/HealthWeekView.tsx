import { aggregateHealthWeek } from "../../lib/healthAggregates";
import { addWeeks, formatWeekRange, getWeekRange } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { DateNav } from "../layout/DateNav";
import { TargetProgressBar } from "./TargetProgressBar";
import { HealthWeekBarChart } from "./HealthWeekBarChart";

const SLEEP_TARGET = 8;
const STRESS_CEILING = 35;

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
  const summary = aggregateHealthWeek(anchorDate);
  const stepGoal = summary.days[0]?.stepGoal ?? 10_000;

  const totalModerate = summary.days.reduce((sum, d) => sum + d.moderateIntensityMin, 0);
  const totalVigorous = summary.days.reduce((sum, d) => sum + d.vigorousIntensityMin, 0);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatWeekRange(start, end)}
        sublabel="Weekly health summary"
        onPrev={() => onAnchorChange(addWeeks(anchorDate, -1))}
        onNext={() => onAnchorChange(addWeeks(anchorDate, 1))}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4">
        <Stat label="👟 Avg steps" value={summary.avgSteps.toLocaleString()} accent="text-sky-400" />
        <Stat label="😴 Avg sleep" value={`${summary.avgSleepHours}h`} accent="text-indigo-400" />
        <Stat
          label="🔥 Avg active"
          value={`${summary.avgActiveCalories} kcal`}
          accent="text-amber-400"
        />
        <Stat label="😰 Avg stress" value={summary.avgStress} accent="text-orange-400" />
        <Stat
          label="📊 Avg HRV"
          value={summary.avgHrv !== null ? `${summary.avgHrv} ms` : "—"}
          accent="text-emerald-400"
        />
        <Stat
          label="🏃 Workouts"
          value={`${summary.totalActivities} · ${summary.totalWorkoutMin}m`}
          accent="text-lime-400"
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
        hint={`Goal ${SLEEP_TARGET}h`}
        days={summary.days}
        getValue={(d) => d.sleepHours}
        getTarget={() => SLEEP_TARGET}
        maxValue={9}
        goalLine={SLEEP_TARGET}
        formatBarLabel={(v) => `${v.toFixed(1)}h`}
        onSelectDate={onSelectDate}
      />

      <HealthWeekBarChart
        title="Stress"
        emoji="😰"
        hint={`Target under ${STRESS_CEILING}`}
        days={summary.days}
        getValue={(d) => d.avgStress}
        getTarget={() => STRESS_CEILING}
        lowerIsBetter
        maxValue={60}
        goalLine={STRESS_CEILING}
        formatBarLabel={(v) => `${v}`}
        onSelectDate={onSelectDate}
      />

      <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
        <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <span>💪</span> Intensity minutes
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TargetProgressBar label="Moderate" value={totalModerate} target={150} />
          <TargetProgressBar label="Vigorous" value={totalVigorous} target={75} />
        </div>
        <p className="mt-4 text-center text-[10px] text-zinc-600">
          Weekly totals · bar colour = progress vs WHO guideline
        </p>
      </div>
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
