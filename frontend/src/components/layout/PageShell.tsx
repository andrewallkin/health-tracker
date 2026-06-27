import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function PageShell({ title, subtitle, onBack, children, footer }: PageShellProps) {
  return (
    <div className="mx-auto min-h-full max-w-[480px] px-4 pb-8 pt-6">
      <header className="mb-6 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <BackIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
        </div>
      </header>
      {children}
      {footer}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
