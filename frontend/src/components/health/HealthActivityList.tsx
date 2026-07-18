import { ACTIVITY_TYPE_EMOJI, ACTIVITY_TYPE_LABELS } from "../../data/mockHealth";
import { formatMinutesAsHm } from "../../lib/formatDuration";
import type { HealthActivity } from "../../types/health";

interface HealthActivityListProps {
  activities: HealthActivity[];
}

export function HealthActivityList({ activities }: HealthActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/2 px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">No recorded activities</p>
      </div>
    );
  }

  const ordered = [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-2">
      {ordered.map((activity) => (
        <article
          key={activity.id}
          className="rounded-2xl border border-white/10 bg-surface-elevated/60 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-base">
                  {ACTIVITY_TYPE_EMOJI[activity.type]}
                </span>
                <h3 className="truncate font-semibold text-white">{activity.name}</h3>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {ACTIVITY_TYPE_LABELS[activity.type]} · {activity.startTime}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              {activity.calories} kcal
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Duration" value={formatMinutesAsHm(activity.durationMin)} />
            <MiniStat label="Avg HR" value={`${activity.avgHr}`} />
            <MiniStat
              label="Distance"
              value={activity.distanceKm ? `${activity.distanceKm} km` : "—"}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}
