import type { AppSection } from "../../types/health";

interface AppTopBarProps {
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

const SECTIONS: { id: AppSection; label: string }[] = [
  { id: "nutrition", label: "Food" },
  { id: "health", label: "Health" },
  { id: "check-in", label: "Check-in" },
];

export function AppTopBar({ section, onSectionChange, onOpenSettings, onLogout }: AppTopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[480px] items-center gap-2 px-4 py-3">
        <nav aria-label="App sections" className="flex min-w-0 flex-1 rounded-full bg-white/5 p-1">
          {SECTIONS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex-1 rounded-full py-2 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <GearIcon />
          </button>
        )}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <SignOutIcon />
          </button>
        )}
      </div>
    </header>
  );
}

function SignOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l-.15-.09a2 2 0 0 0-.73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
