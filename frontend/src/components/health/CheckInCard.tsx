import type { CheckIn } from "../../types/health";
import { MealPhotoView } from "../nutrition/shared/MealPhotoView";

interface CheckInCardProps {
  checkIn: CheckIn;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function CheckInCard({ checkIn, onEdit, onDelete, isDeleting = false }: CheckInCardProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-surface-elevated/80 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
            <span>📋</span> Check-in
          </p>
          {checkIn.weightKg !== null && (
            <p className="mt-2 text-3xl font-bold tracking-tight text-white">
              {checkIn.weightKg}
              <span className="ml-1.5 text-lg font-normal text-zinc-400">kg</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={isDeleting}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {checkIn.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {checkIn.photos.map((photo) => (
            <MealPhotoView
              key={photo.id}
              src={photo.imageUrl}
              alt="Check-in progress photo"
            />
          ))}
        </div>
      )}
    </section>
  );
}
