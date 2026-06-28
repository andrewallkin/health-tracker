import { useEffect, useState, type ReactNode } from "react";
import {
  fetchAiSettings,
  fetchModelOptions,
  updateAiSettings,
  type ModelOption,
} from "../../../lib/api";
import type { DailyGoal } from "../../../types/nutrition";
import { useConfirm } from "../../../context/useConfirm";
import { PageShell } from "../../layout/PageShell";
import { DailyGoalFields } from "../shared/DailyGoalFields";
import {
  dailyGoalFromFieldValues,
  fieldValuesFromDailyGoal,
  isValidDailyGoal,
  type DailyGoalFieldValues,
} from "../shared/dailyGoalFieldUtils";

export interface SettingsSavePayload {
  goal: DailyGoal;
  ai: {
    textModel: string;
    imageModel: string;
  };
}

interface GoalsSettingsPageProps {
  initialGoal: DailyGoal;
  onBack: () => void;
  onSave: (payload: SettingsSavePayload) => void | Promise<void>;
  onApiKeyChange?: (hasApiKey: boolean) => void;
}

export function GoalsSettingsPage({
  initialGoal,
  onBack,
  onSave,
  onApiKeyChange,
}: GoalsSettingsPageProps) {
  const confirm = useConfirm();
  const [goalFields, setGoalFields] = useState<DailyGoalFieldValues>(() =>
    fieldValuesFromDailyGoal(initialGoal),
  );
  const [textModel, setTextModel] = useState("gpt-5-nano");
  const [imageModel, setImageModel] = useState("gpt-5-mini");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyDialog, setKeyDialog] = useState<"closed" | "input">("closed");
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAiSettings(), fetchModelOptions()])
      .then(([ai, models]) => {
        if (cancelled) return;
        setTextModel(ai.textModel);
        setImageModel(ai.imageModel);
        setHasApiKey(ai.hasApiKey);
        setModelOptions(models);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goal = dailyGoalFromFieldValues(goalFields);

  const isValid = isValidDailyGoal(goal) && textModel && imageModel;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        goal,
        ai: {
          textModel,
          imageModel,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const textModels = modelOptions.filter((m) => !m.supportsVision);
  const imageModels = modelOptions.filter((m) => m.supportsVision);

  const openKeyInput = () => {
    setKeyInput("");
    setKeyError(null);
    setKeyDialog("input");
  };

  const closeKeyDialog = () => {
    if (keySaving) return;
    setKeyDialog("closed");
    setKeyInput("");
    setKeyError(null);
  };

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setKeyError("Enter an API key.");
      return;
    }
    setKeySaving(true);
    setKeyError(null);
    try {
      const saved = await updateAiSettings({ apiKey: trimmed, textModel, imageModel });
      setHasApiKey(saved.hasApiKey);
      onApiKeyChange?.(saved.hasApiKey);
      setKeyDialog("closed");
      setKeyInput("");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not save API key");
    } finally {
      setKeySaving(false);
    }
  };

  const handleDeleteKey = async () => {
    setKeySaving(true);
    setKeyError(null);
    try {
      const saved = await updateAiSettings({ clearApiKey: true, textModel, imageModel });
      setHasApiKey(saved.hasApiKey);
      onApiKeyChange?.(saved.hasApiKey);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not remove API key");
    } finally {
      setKeySaving(false);
    }
  };

  const requestDeleteKey = () => {
    setKeyError(null);
    void (async () => {
      const ok = await confirm({
        title: "Remove API key?",
        message: "AI food estimates will stop working until you add a new key.",
        confirmLabel: "Delete key",
        destructive: true,
      });
      if (ok) await handleDeleteKey();
    })();
  };

  return (
    <PageShell
      title="Settings"
      subtitle="Daily targets and AI estimation"
      onBack={onBack}
      footer={
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent px-4 pb-6 pt-10">
          <button
            type="button"
            disabled={!isValid || saving || loading}
            onClick={handleSave}
            className="pointer-events-auto w-full max-w-[448px] rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-28">
        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading settings…</p>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
              <h2 className="mb-1 text-sm font-medium text-amber-400">Daily goals</h2>
              <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                These targets drive your progress ring, macro bars, and remaining budget.
              </p>

              <DailyGoalFields values={goalFields} onChange={setGoalFields} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
              <h2 className="mb-1 text-sm font-medium text-zinc-300">AI estimation</h2>
              <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                Your OpenAI key is stored encrypted on the server and used for AI food estimates.
              </p>

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                {hasApiKey ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckIcon />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">API key saved</p>
                        <p className="text-xs text-zinc-500">Stored encrypted on the server</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={openKeyInput}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={keySaving}
                        onClick={requestDeleteKey}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {keySaving ? "Removing…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-300">No API key</p>
                      <p className="text-xs text-zinc-500">Add a key to enable AI food estimates</p>
                    </div>
                    <button
                      type="button"
                      onClick={openKeyInput}
                      className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20"
                    >
                      Add key
                    </button>
                  </div>
                )}
              </div>

              {keyError && keyDialog === "closed" && (
                <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {keyError}
                </p>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3">
                <Field label="Text model">
                  <select
                    value={textModel}
                    onChange={(e) => setTextModel(e.target.value)}
                    className={modelSelectClass}
                  >
                    {(textModels.length > 0 ? textModels : modelOptions).map((model) => (
                      <option key={model.id} value={model.id}>
                        {formatModelLabel(model, "text")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Image model">
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className={modelSelectClass}
                  >
                    {(imageModels.length > 0 ? imageModels : modelOptions).map((model) => (
                      <option key={model.id} value={model.id}>
                        {formatModelLabel(model, "image")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
          </>
        )}
      </div>

      {keyDialog === "input" && (
        <Modal
          title={hasApiKey ? "Update API key" : "Add API key"}
          onClose={closeKeyDialog}
        >
          <p className="mb-4 text-xs leading-relaxed text-zinc-500">
            Your key is encrypted before storage and never shown again after saving.
          </p>
          {keyError && (
            <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {keyError}
            </p>
          )}
          <input
            type="password"
            autoComplete="off"
            autoFocus
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-…"
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSaveKey();
            }}
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={keySaving}
              onClick={closeKeyDialog}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={keySaving}
              onClick={() => void handleSaveKey()}
              className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-amber-400 disabled:opacity-40"
            >
              {keySaving ? "Saving…" : "Save key"}
            </button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/8";

const modelSelectClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-white/20 focus:bg-white/8";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function formatModelLabel(model: ModelOption, role: "text" | "image"): string {
  if (model.recommendedFor === role) {
    return `${model.label} (recommended)`;
  }
  return model.label;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
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
        aria-labelledby="api-key-dialog-title"
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-surface-elevated p-5 shadow-2xl shadow-black/50"
      >
        <h3 id="api-key-dialog-title" className="text-base font-semibold text-white">
          {title}
        </h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
