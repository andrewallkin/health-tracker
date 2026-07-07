import type { ReactNode } from "react";

import { DecimalInput } from "../../shared/DecimalInput";

interface EnergyInputFieldsProps {
  kilojoules: string;
  calories: string;
  onKilojoulesChange: (value: string) => void;
  onCaloriesChange: (value: string) => void;
  inputClass: string;
}

export function EnergyInputFields({
  kilojoules,
  calories,
  onKilojoulesChange,
  onCaloriesChange,
  inputClass,
}: EnergyInputFieldsProps) {
  return (
    <>
      <Field label="Energy (kJ)">
        <DecimalInput
          allowDecimal={false}
          value={kilojoules}
          onChange={onKilojoulesChange}
          placeholder="From label"
          className={inputClass}
        />
      </Field>
      <Field label="Calories (kcal)">
        <DecimalInput
          allowDecimal={false}
          value={calories}
          onChange={onCaloriesChange}
          placeholder="0"
          className={inputClass}
        />
      </Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
