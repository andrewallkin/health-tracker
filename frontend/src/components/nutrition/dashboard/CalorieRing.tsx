interface CalorieRingProps {
  consumed: number;
  goal: number;
}

export function CalorieRing({ consumed, goal }: CalorieRingProps) {
  const percent = Math.min(consumed / goal, 1);
  const radius = 88;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent);

  return (
    <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
      <svg
        className="-rotate-90"
        width="208"
        height="208"
        viewBox="0 0 208 208"
        aria-hidden
      >
        <circle
          cx="104"
          cy="104"
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx="104"
          cy="104"
          r={radius}
          fill="none"
          stroke="var(--color-calorie)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold tracking-tight text-white">
          {consumed.toLocaleString()}
        </span>
        <span className="mt-0.5 text-sm text-zinc-400">
          of {goal.toLocaleString()} kcal
        </span>
        <span className="mt-2 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
          {Math.round(percent * 100)}%
        </span>
      </div>
    </div>
  );
}
