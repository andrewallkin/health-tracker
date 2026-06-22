import { ACTIVITY_TYPE_LABELS } from "../../data/mockHealth";
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

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <article
          key={activity.id}
          className="rounded-2xl border border-white/10 bg-surface-elevated/60 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ActivityIcon type={activity.type} />
                <h3 className="truncate font-semibold text-white">{activity.name}</h3>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {activity.startTime} · {ACTIVITY_TYPE_LABELS[activity.type]}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              {activity.calories} kcal
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Duration" value={`${activity.durationMin}m`} />
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

function ActivityIcon({ type }: { type: HealthActivity["type"] }) {
  const paths: Record<HealthActivity["type"], string> = {
    strength_training:
      "M6 12h12M8 8v8M16 8v8M4 12h2M18 12h2",
    running: "M13 5l3 3-5 5-3-3 5-5zM6 20l4-8 4 2-2 6",
    cycling: "M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12l-2 6",
    walking: "M14 4l2 2-4 4-2-6M8 20l2-8 4 2",
    hiking: "M12 3v4M8 21l4-10 4 10M6 12h12",
    other: "M12 8v8M8 12h8",
  };

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={paths[type]} />
      </svg>
    </span>
  );
}
