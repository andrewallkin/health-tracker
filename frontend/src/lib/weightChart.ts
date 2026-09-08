export function seriesPath(
  values: Array<number | null>,
  xOf: (index: number) => number,
  yOf: (value: number) => number,
): string {
  const parts: string[] = [];
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const command = drawing ? "L" : "M";
    parts.push(`${command}${xOf(index)},${yOf(value)}`);
    drawing = true;
  });
  return parts.join(" ");
}

export function sparseTickIndices(length: number, maxTicks = 6): number[] {
  if (length <= 0) return [];
  if (length <= maxTicks) return Array.from({ length }, (_, index) => index);
  const ticks = new Set<number>([0, length - 1]);
  for (let i = 1; i < maxTicks - 1; i += 1) {
    ticks.add(Math.round((i * (length - 1)) / (maxTicks - 1)));
  }
  return [...ticks].sort((a, b) => a - b);
}
