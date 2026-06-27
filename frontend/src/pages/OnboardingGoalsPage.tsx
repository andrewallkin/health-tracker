import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DailyGoalFields } from "../components/nutrition/shared/DailyGoalFields";
import {
  dailyGoalFromFieldValues,
  fieldValuesFromDailyGoal,
  isValidDailyGoal,
  type DailyGoalFieldValues,
} from "../components/nutrition/shared/dailyGoalFields";
import type { DailyGoal } from "../types/nutrition";
import { DEFAULT_DAILY_GOAL, fetchGoals, updateGoals } from "../lib/api";
import { getErrorMessage } from "../lib/errors";

export function OnboardingGoalsPage() {
  const navigate = useNavigate();
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [goalFields, setGoalFields] = useState<DailyGoalFieldValues>(() =>
    fieldValuesFromDailyGoal(DEFAULT_DAILY_GOAL),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGoals()
      .then((goal) => {
        if (!cancelled && goal !== null) {
          navigate("/", { replace: true });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err, "Could not check your goals"));
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const goal = dailyGoalFromFieldValues(goalFields);
  const isValid = isValidDailyGoal(goal);

  const saveGoal = async (payload: DailyGoal) => {
    setSaving(true);
    setError(null);
    try {
      await updateGoals(payload);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Could not save your targets"));
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (!isValid || saving) return;
    void saveGoal(goal);
  };

  const handleSkip = () => {
    if (saving) return;
    void saveGoal(DEFAULT_DAILY_GOAL);
  };

  if (checkingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 shrink-0 overflow-hidden rounded-3xl ring-1 ring-white/10">
            <img src="/favicon.svg" alt="" className="h-full w-full" width={64} height={64} />
          </div>
          <h1 className="text-2xl font-bold text-white">Set your daily targets</h1>
          <p className="mt-1 text-sm text-zinc-400">
            These drive your progress ring, macro bars, and remaining budget.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-surface-elevated p-6 shadow-lg">
          {error && (
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
          )}

          <DailyGoalFields values={goalFields} onChange={setGoalFields} />

          <button
            type="button"
            disabled={!isValid || saving}
            onClick={handleContinue}
            className="w-full rounded-xl bg-calorie px-4 py-2.5 text-sm font-semibold text-surface transition hover:bg-amber-400 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSkip}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-60"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
