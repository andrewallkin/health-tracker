import type { ReactNode } from "react";
import { PageShell } from "../../layout/PageShell";

type AddFoodOption = "saved-meals" | "quick-log" | "describe-photo";

interface AddFoodHubPageProps {
  onBack: () => void;
  onSelect: (option: AddFoodOption) => void;
}

const options: {
  id: AddFoodOption;
  title: string;
  description: string;
  icon: ReactNode;
  accent: string;
  available: boolean;
}[] = [
  {
    id: "saved-meals",
    title: "Saved meals",
    description: "Pick from your meal library and log with servings.",
    icon: <BookmarkIcon />,
    accent: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    available: true,
  },
  {
    id: "quick-log",
    title: "Quick log",
    description: "Log a one-off item with calories and macros.",
    icon: <PenIcon />,
    accent: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    available: true,
  },
  {
    id: "describe-photo",
    title: "Describe or photo",
    description: "Estimate from a note, photo, or nutrition label.",
    icon: <CameraIcon />,
    accent: "border-green-500/30 bg-green-500/10 text-green-400",
    available: true,
  },
];

export function AddFoodHubPage({ onBack, onSelect }: AddFoodHubPageProps) {
  return (
    <PageShell title="Add food" subtitle="How would you like to log?" onBack={onBack}>
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => option.available && onSelect(option.id)}
            disabled={!option.available}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              option.available
                ? "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/6 active:scale-[0.99]"
                : "cursor-not-allowed border-white/6 bg-white/2 opacity-70"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${option.accent}`}
              >
                {option.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-zinc-100">{option.title}</h2>
                  {!option.available && (
                    <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">{option.description}</p>
              </div>
              {option.available && (
                <div className="flex shrink-0 items-center self-center text-zinc-600">
                  <ChevronIcon />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </PageShell>
  );
}

function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
