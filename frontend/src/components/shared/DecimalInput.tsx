import type { InputHTMLAttributes } from "react";

import { sanitizeNumericInput } from "../../lib/numericInput";

interface DecimalInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
}

export function DecimalInput({
  value,
  onChange,
  allowDecimal = true,
  ...rest
}: DecimalInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(sanitizeNumericInput(event.target.value, allowDecimal))}
    />
  );
}
