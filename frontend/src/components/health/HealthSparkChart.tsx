interface HealthSparkChartProps {
  data: number[];
  label: string;
  emoji?: string;
  caption: string;
  color: string;
  fillColor?: string;
  yMin?: number;
  yMax?: number;
  height?: number;
}

export function HealthSparkChart({
  data,
  label,
  emoji,
  caption,
  color,
  fillColor,
  yMin = 0,
  yMax = 100,
  height = 88,
}: HealthSparkChartProps) {
  if (data.length === 0) return null;

  const range = yMax - yMin || 1;
  const width = 100;
  const pad = 2;

  const points = data.map((value, index) => {
    const x = pad + (index / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (value - yMin) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const areaPoints = [
    `${pad},${height - pad}`,
    ...points,
    `${width - pad},${height - pad}`,
  ].join(" ");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          {emoji && <span>{emoji}</span>}
          {label}
        </p>
        <p className="shrink-0 text-xs text-zinc-500">{caption}</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon points={areaPoints} fill={fillColor ?? `${color}26`} />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
        <span>Midnight</span>
        <span>Now</span>
      </div>
    </div>
  );
}
