import { useCallback, useState } from "react";

import { kjToKcal, kcalToKj } from "../lib/energyConversion";
import { parseLocaleNumber } from "../lib/numericInput";

function initialCaloriesString(initialCalories?: number): string {
  if (initialCalories == null || initialCalories <= 0) return "";
  return String(initialCalories);
}

function initialKilojoulesString(initialCalories?: number): string {
  if (initialCalories == null || initialCalories <= 0) return "";
  return String(kcalToKj(initialCalories));
}

export function useEnergyInput(initialCalories?: number) {
  const [kilojoules, setKilojoules] = useState(() =>
    initialKilojoulesString(initialCalories),
  );
  const [calories, setCalories] = useState(() => initialCaloriesString(initialCalories));

  const onKilojoulesChange = useCallback((value: string) => {
    setKilojoules(value);
    const parsed = parseLocaleNumber(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setCalories(String(kjToKcal(parsed)));
    }
  }, []);

  const onCaloriesChange = useCallback((value: string) => {
    setCalories(value);
  }, []);

  return { kilojoules, calories, onKilojoulesChange, onCaloriesChange };
}
