import { styleForRatio } from "../../lib/healthColors";

function formatMetricValue(value: number): string {
  return value % 1 !== 0 ? value.toFixed(1) : value.toLocaleString();
}

interface TargetProgressBarProps {
  value: number;
  target: number;
  label?: string;
  showValues?: boolean;
}

export function TargetProgressBar({
  value,
  target,
  label,
  showValues = true,
}: TargetProgressBarProps) {
  const bandStyle = styleForRatio(value, target);
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;

  return (
    <div>
      {(label || showValues) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-xs text-zinc-400">{label}</span>}
          {showValues && (
            <span className={`text-sm font-semibold ${bandStyle.text}`}>
              {formatMetricValue(value)}
              {target > 0 && (
                <span className="font-normal text-zinc-500">
                  {" "}
                  / {formatMetricValue(target)}
                </span>
              )}
            </span>
          )}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bandStyle.bg}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
