import { useState } from "react";

import { formatSevenDayAvgKg, formatWeightKg, type WeightChartDay } from "../../lib/checkIn";
import { formatShortDate } from "../../lib/dates";
import { seriesPath, sparseTickIndices } from "../../lib/weightChart";

export type { WeightChartDay } from "../../lib/checkIn";

interface CheckInWeightChartProps {
  days: WeightChartDay[];
  onSelectDate: (dateKey: string) => void;
  title?: string;
}

const WIDTH = 320;
const HEIGHT = 148;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM_DEFAULT = 10;
const PAD_BOTTOM_COMPACT = 22;

export function CheckInWeightChart({
  days,
  onSelectDate,
  title = "Weight",
}: CheckInWeightChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const compact = days.length > 7;
  const padBottom = compact ? PAD_BOTTOM_COMPACT : PAD_BOTTOM_DEFAULT;

  const values = days.flatMap((day) => {
    const points: number[] = [];
    if (day.weight !== null) points.push(day.weight);
    if (day.avg) points.push(day.avg.averageKg);
    return points;
  });
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max((rawMax - rawMin) * 0.18, 0.4);
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yRange = yMax - yMin || 1;

  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = HEIGHT - PAD_TOP - padBottom;
  const lastIndex = Math.max(days.length - 1, 1);

  const xOf = (index: number) => PAD_LEFT + (index / lastIndex) * innerWidth;
  const yOf = (value: number) => PAD_TOP + (1 - (value - yMin) / yRange) * innerHeight;

  const weightPath = seriesPath(
    days.map((day) => day.weight),
    xOf,
    yOf,
  );
  const avgPath = seriesPath(
    days.map((day) => (day.avg ? day.avg.averageKg : null)),
    xOf,
    yOf,
  );

  const ticks = [yMax, (yMin + yMax) / 2, yMin];
  const hovered = hoverIndex !== null ? days[hoverIndex] : null;
  const sparseTicks = compact ? sparseTickIndices(days.length) : [];

  const indexFromClientX = (clientX: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    for (let index = 0; index < days.length; index += 1) {
      const delta = Math.abs(xOf(index) - x);
      if (delta < best) {
        best = delta;
        nearest = index;
      }
    }
    return nearest;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <span>⚖️</span> {title}
        </p>
        <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            Daily
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-sky-400" />
            7-day avg
          </span>
        </div>
      </div>

      <div className="relative">
        {hovered && (
          <div className="pointer-events-none absolute right-0 top-0 z-10 rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-left shadow-lg">
            <p className="text-[11px] font-semibold text-zinc-300">
              {formatShortDate(hovered.date)}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-teal-300">
              Daily {hovered.weight !== null ? `${formatWeightKg(hovered.weight)} kg` : "—"}
            </p>
            <p className="text-[11px] tabular-nums text-sky-300">
              7-day avg{" "}
              {hovered.avg ? `${formatSevenDayAvgKg(hovered.avg.averageKg)} kg` : "—"}
            </p>
          </div>
        )}

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-40 w-full"
          role="img"
          aria-label={`${title} weight and 7-day average`}
          onPointerMove={(event) => {
            setHoverIndex(indexFromClientX(event.clientX, event.currentTarget));
          }}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerUp={(event) => {
            const index = indexFromClientX(event.clientX, event.currentTarget);
            onSelectDate(days[index].date);
          }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <text
                x={PAD_LEFT - 6}
                y={yOf(tick) + 3}
                textAnchor="end"
                fill="#71717a"
                fontSize="9"
              >
                {formatSevenDayAvgKg(tick)}
              </text>
            </g>
          ))}

          {hoverIndex !== null && (
            <line
              x1={xOf(hoverIndex)}
              x2={xOf(hoverIndex)}
              y1={PAD_TOP}
              y2={HEIGHT - padBottom}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
            />
          )}

          {avgPath && (
            <path
              d={avgPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="4 3"
            />
          )}
          {weightPath && (
            <path
              d={weightPath}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {days.map((day, index) =>
            day.avg ? (
              <circle
                key={`${day.date}-avg`}
                cx={xOf(index)}
                cy={yOf(day.avg.averageKg)}
                r={hoverIndex === index ? 3.5 : 2.5}
                fill="#38bdf8"
              />
            ) : null,
          )}
          {days.map((day, index) =>
            day.weight !== null ? (
              <circle
                key={`${day.date}-weight`}
                cx={xOf(index)}
                cy={yOf(day.weight)}
                r={hoverIndex === index ? 5 : 4}
                fill="#2dd4bf"
                stroke="#181b24"
                strokeWidth="1.5"
              />
            ) : null,
          )}

          {compact &&
            sparseTicks.map((index) => (
              <text
                key={days[index].date}
                x={xOf(index)}
                y={HEIGHT - 4}
                textAnchor="middle"
                fill="#71717a"
                fontSize="9"
              >
                {formatShortDate(days[index].date)}
              </text>
            ))}
        </svg>
      </div>

      {!compact && (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className="rounded-lg px-0.5 py-1.5 text-center transition hover:bg-white/5"
            >
              <p className="text-[10px] font-semibold uppercase text-zinc-500">{day.weekday}</p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-200">
                {day.weight !== null ? formatWeightKg(day.weight) : "—"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
