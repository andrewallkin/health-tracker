import type { ReactNode } from "react";

import { DecimalInput } from "../../shared/DecimalInput";
import type { DailyGoalFieldValues } from "./dailyGoalFieldUtils";

interface DailyGoalFieldsProps {
  values: DailyGoalFieldValues;
  onChange: (values: DailyGoalFieldValues) => void;
}

export function DailyGoalFields({ values, onChange }: DailyGoalFieldsProps) {
  return (
    <>
      <Field label="Daily calorie target (kcal)">
        <DecimalInput
          allowDecimal={false}
          value={values.calories}
          onChange={(calories) => onChange({ ...values, calories })}
          className={inputClass}
        />
      </Field>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Protein (g)">
          <DecimalInput
            value={values.protein}
            onChange={(protein) => onChange({ ...values, protein })}
            className={inputClass}
          />
        </Field>
        <Field label="Carbs (g)">
          <DecimalInput
            value={values.carbs}
            onChange={(carbs) => onChange({ ...values, carbs })}
            className={inputClass}
          />
        </Field>
        <Field label="Fat (g)">
          <DecimalInput
            value={values.fat}
            onChange={(fat) => onChange({ ...values, fat })}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
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
