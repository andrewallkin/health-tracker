import type { DashboardTab } from "../../types/nutrition";

interface HomeFooterProps {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  onAddFood?: () => void;
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function HomeFooter({ active, onChange, onAddFood }: HomeFooterProps) {
  const showAddFood = active === "day" && onAddFood;

  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-surface from-50% via-surface/95 to-transparent pt-8">
      <div className="pointer-events-auto mx-auto max-w-[480px] space-y-3 px-4 pb-6">
        {showAddFood && (
          <button
            type="button"
            onClick={onAddFood}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/25 transition hover:bg-amber-400 active:scale-[0.99]"
          >
            <PlusIcon />
            Add food
          </button>
        )}

        <nav aria-label="Dashboard views">
          <div className="flex w-full rounded-full border border-white/10 bg-surface-elevated/95 p-1 shadow-lg shadow-black/40 backdrop-blur-md">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                  active === tab.id
                    ? "bg-amber-500 text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
