import type { LogEntry, MealSlot } from "../../../types/nutrition";
import { MealCard } from "./MealCard";

interface MealListProps {
  entries: LogEntry[];
  onDeleteEntry: (id: string) => void;
  onEditEntry: (id: string) => void;
}

const slotOrder: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const slotLabels: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export function MealList({ entries, onDeleteEntry, onEditEntry }: MealListProps) {
  const grouped = slotOrder
    .map((slot) => ({
      slot,
      items: entries.filter((e) => e.slot === slot),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Today&apos;s meals
      </h2>
      {grouped.map(({ slot, items }) => (
        <div key={slot}>
          <h3 className="mb-2.5 text-xs font-medium text-zinc-400">{slotLabels[slot]}</h3>
          <div className="space-y-2">
            {items.map((entry) => (
              <MealCard
                key={entry.id}
                entry={entry}
                onDelete={() => onDeleteEntry(entry.id)}
                onEdit={() => onEditEntry(entry.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
