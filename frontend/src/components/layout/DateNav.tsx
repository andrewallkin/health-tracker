import type { ReactNode } from "react";

interface DateNavProps {
  label: string;
  sublabel?: string;
  onPrev: () => void;
  onNext: () => void;
  onJumpToday?: () => void;
  showToday?: boolean;
  disableNext?: boolean;
  trailing?: ReactNode;
}

export function DateNav({
  label,
  sublabel,
  onPrev,
  onNext,
  onJumpToday,
  showToday,
  disableNext = false,
  trailing,
}: DateNavProps) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-2">
        <NavButton onClick={onPrev} ariaLabel="Previous">
          <ChevronLeft />
        </NavButton>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg font-bold tracking-tight text-white">{label}</h1>
          {sublabel && <p className="mt-0.5 truncate text-xs text-zinc-500">{sublabel}</p>}
        </div>

        <div className="flex items-center gap-2">
          {trailing}
          <NavButton onClick={onNext} ariaLabel="Next" disabled={disableNext}>
            <ChevronRight />
          </NavButton>
        </div>
      </div>

      {showToday && onJumpToday && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onJumpToday}
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20"
          >
            Jump to today
          </button>
        </div>
      )}
    </header>
  );
}

function NavButton({
  onClick,
  ariaLabel,
  disabled = false,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-zinc-400"
    >
      {children}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
