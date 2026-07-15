import { aggregateHealthWeek } from "../../lib/healthAggregates";
import { addWeeks, formatWeekRange, getWeekRange } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { DateNav } from "../layout/DateNav";
import { HealthWeekBarChart } from "./HealthWeekBarChart";

const SLEEP_TARGET = 8;

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
