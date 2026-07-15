export interface HealthDetailRow {
  label: string;
  value: string;
}

interface HealthDetailModalProps {
  title: string;
  rows: HealthDetailRow[];
  onClose: () => void;
}

export function HealthDetailModal({ title, rows, onClose }: HealthDetailModalProps) {
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
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-surface-elevated p-5 shadow-2xl shadow-black/50"
      >
        <h3 id="health-detail-title" className="text-base font-semibold text-white">
          {title}
        </h3>
        <dl className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-zinc-400">{row.label}</dt>
              <dd className="text-sm font-semibold text-white">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
