import type { AppSection } from "../../types/health";

interface AppTopBarProps {
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
}

const SECTIONS: { id: AppSection; label: string }[] = [
  { id: "nutrition", label: "Food" },
  { id: "health", label: "Health" },
];

export function AppTopBar({ section, onSectionChange }: AppTopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[480px] items-center px-4 py-3">
        <nav aria-label="App sections" className="flex w-full rounded-full bg-white/5 p-1">
          {SECTIONS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
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
      </div>
    </header>
  );
}
