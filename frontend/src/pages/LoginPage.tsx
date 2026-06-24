import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage, isValidEmail } from "../lib/errors";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    const redirect = (location.state as { from?: string } | undefined)?.from ?? "/";
    return <Navigate to={redirect} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      const redirect = (location.state as { from?: string } | undefined)?.from ?? "/";
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to sign in"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 shrink-0 overflow-hidden rounded-3xl ring-1 ring-white/10">
            <img src="/favicon.svg" alt="" className="h-full w-full" width={64} height={64} />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-400">Sign in to Health Tracker</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-surface-elevated p-6 shadow-lg">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-calorie/50 focus:outline-none focus:ring-2 focus:ring-calorie/20"
              />
              {emailError && <p className="mt-1.5 text-xs text-rose-400">{emailError}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-calorie/50 focus:outline-none focus:ring-2 focus:ring-calorie/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-calorie px-4 py-2.5 text-sm font-semibold text-surface transition hover:bg-amber-400 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-400">
            Need an account?{" "}
            <Link to="/register" className="font-medium text-calorie hover:text-amber-300">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
