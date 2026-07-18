export interface HealthDetailRow {
  emoji: string;
  label: string;
  value: string;
  accent?: string;
}

interface HealthDetailModalProps {
  emoji: string;
  title: string;
  accent: string;
  rows: HealthDetailRow[];
  onClose: () => void;
}

export function HealthDetailModal({
  emoji,
  title,
  accent,
  rows,
  onClose,
}: HealthDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="health-detail-title"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-surface-elevated shadow-2xl shadow-black/50"
      >
        <div className={`border-b border-white/10 px-5 py-4 ${accentHeaderBg(accent)}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/25 text-2xl">
                {emoji}
              </span>
              <h3
                id="health-detail-title"
                className={`text-base font-semibold tracking-tight ${accent}`}
              >
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-xl px-2 py-1 text-lg leading-none text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
            >
              ×
            </button>
          </div>
        </div>

        <dl className="space-y-2 p-4">
          {rows.map((row) => {
            const rowAccent = row.accent ?? accent;
            return (
              <div
                key={row.label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${accentChipBg(rowAccent)}`}
                >
                  {row.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <dt className={`text-[10px] font-bold uppercase tracking-wider ${rowAccent}`}>
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold text-white">{row.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

function accentHeaderBg(accent: string): string {
  if (accent.includes("indigo")) return "bg-indigo-500/10";
  if (accent.includes("rose")) return "bg-rose-500/10";
  if (accent.includes("emerald")) return "bg-emerald-500/10";
  if (accent.includes("violet")) return "bg-violet-500/10";
  if (accent.includes("amber")) return "bg-amber-500/10";
  if (accent.includes("orange")) return "bg-orange-500/10";
  return "bg-white/5";
}

function accentChipBg(accent: string): string {
  if (accent.includes("indigo")) return "bg-indigo-500/15";
  if (accent.includes("rose")) return "bg-rose-500/15";
  if (accent.includes("emerald")) return "bg-emerald-500/15";
  if (accent.includes("violet")) return "bg-violet-500/15";
  if (accent.includes("sky")) return "bg-sky-500/15";
  if (accent.includes("amber")) return "bg-amber-500/15";
  if (accent.includes("orange")) return "bg-orange-500/15";
  return "bg-white/8";
}
