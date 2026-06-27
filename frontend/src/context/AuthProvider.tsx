import { useEffect, useMemo, useState } from "react";

import * as authApi from "../lib/authApi";
import type { User } from "../lib/authApi";
import { setAccessToken } from "../lib/client";
import {
  AuthContext,
  invalidateSessionBootstrapCache,
  loadUserFromRefreshCookie,
} from "./auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadUserFromRefreshCookie().then((loadedUser) => {
      if (cancelled) return;
      setUser(loadedUser);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      invalidateSessionBootstrapCache();
      setUser(null);
    }
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      async login(email: string, password: string) {
        const data = await authApi.login(email, password);
        setAccessToken(data.access_token);
        setUser(data.user);
      },
      async register(email: string, password: string) {
        const data = await authApi.register(email, password);
        setAccessToken(data.access_token);
        setUser(data.user);
      },
      async logout() {
        try {
          await authApi.logout();
        } finally {
          invalidateSessionBootstrapCache();
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
