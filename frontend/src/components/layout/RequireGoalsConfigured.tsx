import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { fetchGoals } from "../../lib/api";

export function RequireGoalsConfigured() {
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    fetchGoals()
      .then((goal) => {
        if (!cancelled) {
          setStatus(goal === null ? "missing" : "ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (status === "missing") {
    return <Navigate to="/onboarding/goals" replace />;
  }

  return <Outlet />;
}
