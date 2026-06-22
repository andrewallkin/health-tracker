import { useEffect, useState, type ReactNode } from "react";
import {
  fetchAiSettings,
  fetchModelOptions,
  type ModelOption,
} from "../../../lib/api";
import type { DailyGoal } from "../../../types/nutrition";
import { PageShell } from "../../layout/PageShell";

export interface SettingsSavePayload {
  goal: DailyGoal;
  ai: {
    apiKey?: string;
    textModel: string;
    imageModel: string;
  };
}

interface GoalsSettingsPageProps {
  initialGoal: DailyGoal;
  onBack: () => void;
  onSave: (payload: SettingsSavePayload) => void | Promise<void>;
}

export function GoalsSettingsPage({ initialGoal, onBack, onSave }: GoalsSettingsPageProps) {
  const [calories, setCalories] = useState(String(initialGoal.calories));
  const [protein, setProtein] = useState(String(initialGoal.protein));
  const [carbs, setCarbs] = useState(String(initialGoal.carbs));
  const [fat, setFat] = useState(String(initialGoal.fat));
  const [apiKey, setApiKey] = useState("");
  const [textModel, setTextModel] = useState("gpt-5-nano");
  const [imageModel, setImageModel] = useState("gpt-5-mini");
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAiSettings(), fetchModelOptions()])
      .then(([ai, models]) => {
        if (cancelled) return;
        setTextModel(ai.textModel);
        setImageModel(ai.imageModel);
        setApiKeyHint(ai.hasApiKey ? ai.apiKeyHint : null);
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

  const goal: DailyGoal = {
    calories: parsePositive(calories),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  };

  const isValid = goal.calories > 0 && textModel && imageModel;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        goal,
        ai: {
          apiKey: apiKey.trim() || undefined,
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

              <Field label="Daily calorie target (kcal)">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Protein (g)">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Carbs (g)">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Fat (g)">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
              <h2 className="mb-1 text-sm font-medium text-zinc-300">AI estimation</h2>
              <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                Your OpenAI key is stored encrypted on the server and used for describe/photo
                estimates.
              </p>

              <Field label="OpenAI API key">
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiKeyHint ? `Current: ${apiKeyHint}` : "sk-…"}
                  className={inputClass}
                />
              </Field>
              <p className="mt-1.5 text-xs text-zinc-600">
                Leave blank to keep your existing key.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Text model">
                  <select
                    value={textModel}
                    onChange={(e) => setTextModel(e.target.value)}
                    className={inputClass}
                  >
                    {(textModels.length > 0 ? textModels : modelOptions).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Image model">
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className={inputClass}
                  >
                    {(imageModels.length > 0 ? imageModels : modelOptions).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/8";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function parseNonNegative(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function parsePositive(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}
