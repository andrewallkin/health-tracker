import type { LogEntry } from "../../../types/nutrition";
import { MealPhotoView } from "../shared/MealPhotoView";

interface MealCardProps {
  entry: LogEntry;
  onDelete: () => void;
  onEdit?: () => void;
}

export function MealCard({ entry, onDelete, onEdit }: MealCardProps) {
  return (
    <article className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
      <div className="flex items-start gap-3">
        {entry.imageUrl && (
          <MealPhotoView src={entry.imageUrl} alt={entry.name} size="thumbnail" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium text-zinc-100">{entry.name}</h3>
                {entry.servings !== 1 && (
                  <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-xs text-zinc-400">
                    ×{entry.servings}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{entry.time}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={onEdit}
                disabled={!onEdit}
                aria-label={`Edit ${entry.name}`}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/8 hover:text-zinc-300"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${entry.name}`}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400"
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
              {entry.calories} kcal
            </span>
            <MacroChip label="P" value={entry.protein} color="text-blue-400 bg-blue-500/15" />
            <MacroChip label="C" value={entry.carbs} color="text-green-400 bg-green-500/15" />
            <MacroChip label="F" value={entry.fat} color="text-rose-400 bg-rose-500/15" />
          </div>
        </div>
      </div>
    </article>
  );
}

function MacroChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${color}`}>
      {label} {value}g
    </span>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
