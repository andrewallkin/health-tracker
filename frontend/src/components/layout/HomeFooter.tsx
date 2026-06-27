import type { DashboardTab } from "../../types/nutrition";

interface HomeFooterProps {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function HomeFooter({ active, onChange }: HomeFooterProps) {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-surface from-50% via-surface/95 to-transparent pt-6">
      <div className="pointer-events-auto mx-auto max-w-[480px] px-4 pb-6">
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
