import type { ReactNode } from "react";
import { PageShell } from "../../layout/PageShell";

type AddFoodOption = "saved-meals" | "quick-log" | "describe-photo";

interface AddFoodHubPageProps {
  hasApiKey: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
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
    title: "AI estimate",
    description: "Describe your meal or add a photo.",
    icon: <SparklesIcon />,
    accent: "border-green-500/30 bg-green-500/10 text-green-400",
    available: true,
  },
];

export function AddFoodHubPage({
  hasApiKey,
  onBack,
  onOpenSettings,
  onSelect,
}: AddFoodHubPageProps) {
  return (
    <PageShell title="Add food" subtitle="How would you like to log?" onBack={onBack}>
      <div className="space-y-3">
        {!hasApiKey && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
            <p>Add an OpenAI API key in Settings to use AI estimates.</p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-2 font-medium text-amber-400 underline underline-offset-2 transition hover:text-amber-300"
            >
              Add key in Settings
            </button>
          </div>
        )}

        {options.map((option) => {
          const aiOption = option.id === "describe-photo";
          const disabled = aiOption && !hasApiKey;

          return (
          <button
            key={option.id}
            type="button"
            onClick={() => !disabled && onSelect(option.id)}
            disabled={disabled}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              !disabled
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
                  {disabled && (
                    <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Needs API key
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">{option.description}</p>
              </div>
              {!disabled && (
                <div className="flex shrink-0 items-center self-center text-zinc-600">
                  <ChevronIcon />
                </div>
              )}
            </div>
          </button>
          );
        })}
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

function SparklesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
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
