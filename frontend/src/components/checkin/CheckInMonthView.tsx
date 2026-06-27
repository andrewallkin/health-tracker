import { addMonths, formatMonthYear, monthFromDateKey } from "../../lib/dates";
import { PAGE_SHELL } from "../../lib/layout";
import { DateNav } from "../layout/DateNav";

interface CheckInMonthViewProps {
  anchorDate: string;
  onAnchorChange: (dateKey: string) => void;
}

export function CheckInMonthView({ anchorDate, onAnchorChange }: CheckInMonthViewProps) {
  const { year, month } = monthFromDateKey(anchorDate);

  return (
    <div className={PAGE_SHELL}>
      <DateNav
        label={formatMonthYear(year, month)}
        sublabel="Monthly check-ins"
        onPrev={() => onAnchorChange(addMonths(anchorDate, -1))}
        onNext={() => onAnchorChange(addMonths(anchorDate, 1))}
      />

      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
        <p className="text-sm text-zinc-500">Monthly check-in summary coming soon.</p>
      </div>
    </div>
  );
}
