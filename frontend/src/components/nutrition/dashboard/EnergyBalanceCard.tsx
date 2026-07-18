import type { EnergyBalance } from "../../../lib/energyBalance";

interface EnergyBalanceCardProps {
  balance: EnergyBalance;
  /** day = plain labels; average = "Avg …" labels + optional Based on N days */
  mode: "day" | "average";
}

function netTone(net: number): { valueClass: string; label: string } {
  if (net < 0) return { valueClass: "text-emerald-400", label: "deficit" };
  if (net > 0) return { valueClass: "text-rose-400", label: "surplus" };
  return { valueClass: "text-zinc-200", label: "even" };
}

function unavailableMessage(reason: "disconnected" | "error" | "missing"): string {
  if (reason === "disconnected") return "Connect Garmin in Settings to see burn";
  if (reason === "error") return "Could not load burn data";
  return "Burn unavailable";
}

export function EnergyBalanceCard({ balance, mode }: EnergyBalanceCardProps) {
  const eatenLabel = mode === "average" ? "Avg eaten" : "Eaten";
  const burnedLabel = mode === "average" ? "Avg burned" : "Burned";
  const netLabel = mode === "average" ? "Avg net" : "Net";

  return (
    <section
      aria-label="Energy balance"
      className="mb-5 rounded-2xl border border-white/10 bg-surface-elevated/80 p-4"
    >
      <h2 className="mb-3 text-sm font-medium text-zinc-400">Energy balance</h2>

      {balance.status === "loading" && (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/6" />
          ))}
        </div>
      )}

      {balance.status === "unavailable" && (
        <p className="py-3 text-center text-sm text-zinc-500">
          {unavailableMessage(balance.reason)}
        </p>
      )}

      {balance.status === "ready" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric label={eatenLabel} value={balance.eaten} valueClass="text-amber-400" />
            <Metric label={burnedLabel} value={balance.burned} valueClass="text-zinc-100" />
            <Metric
              label={netLabel}
              value={balance.net}
              valueClass={netTone(balance.net).valueClass}
              hint={netTone(balance.net).label}
              emphasize
            />
          </div>
          {mode === "average" && balance.daysUsed != null && balance.daysUsed > 0 && (
            <p className="mt-3 text-center text-xs text-zinc-500">
              Based on {balance.daysUsed} day{balance.daysUsed === 1 ? "" : "s"}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  valueClass,
  hint,
  emphasize,
}: {
  label: string;
  value: number;
  valueClass: string;
  hint?: string;
  emphasize?: boolean;
}) {
  const display = emphasize && value > 0 ? `+${value}` : String(value);
  return (
    <div
      className={`flex flex-col items-center rounded-xl border px-2 py-3 ${
        emphasize ? "border-white/15 bg-white/6" : "border-white/8 bg-white/3"
      }`}
    >
      <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className={`text-lg font-bold tabular-nums leading-none ${valueClass}`}>
        {display}
      </span>
      <span className="mt-1 text-[10px] font-medium text-zinc-500">kcal</span>
      {hint && (
        <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${valueClass}`}>
          {hint}
        </span>
      )}
    </div>
  );
}
