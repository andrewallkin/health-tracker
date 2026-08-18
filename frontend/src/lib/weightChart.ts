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
