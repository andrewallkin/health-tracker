import type { ReactNode } from "react";

import type { DailyGoal } from "../../../types/nutrition";

export interface DailyGoalFieldValues {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

interface DailyGoalFieldsProps {
  values: DailyGoalFieldValues;
  onChange: (values: DailyGoalFieldValues) => void;
}

export function DailyGoalFields({ values, onChange }: DailyGoalFieldsProps) {
  return (
    <>
      <Field label="Daily calorie target (kcal)">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={values.calories}
          onChange={(e) => onChange({ ...values, calories: e.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Protein (g)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={values.protein}
            onChange={(e) => onChange({ ...values, protein: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Carbs (g)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={values.carbs}
            onChange={(e) => onChange({ ...values, carbs: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Fat (g)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={values.fat}
            onChange={(e) => onChange({ ...values, fat: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}

export function dailyGoalFromFieldValues(values: DailyGoalFieldValues): DailyGoal {
  return {
    calories: parsePositive(values.calories),
    protein: parseNonNegative(values.protein),
    carbs: parseNonNegative(values.carbs),
    fat: parseNonNegative(values.fat),
  };
}

export function fieldValuesFromDailyGoal(goal: DailyGoal): DailyGoalFieldValues {
  return {
    calories: String(goal.calories),
    protein: String(goal.protein),
    carbs: String(goal.carbs),
    fat: String(goal.fat),
  };
}

export function isValidDailyGoal(goal: DailyGoal): boolean {
  return goal.calories > 0;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/8";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function parseNonNegative(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function parsePositive(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}
