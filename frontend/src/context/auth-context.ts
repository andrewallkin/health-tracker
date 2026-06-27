import { createContext } from "react";

import * as authApi from "../lib/authApi";
import type { User } from "../lib/authApi";
import { setAccessToken } from "../lib/client";

export type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Single-flight load so React Strict Mode does not call refresh twice (backend tokens are one-use). */
let initialSessionPromise: Promise<User | null> | null = null;

export function loadUserFromRefreshCookie(): Promise<User | null> {
  if (!initialSessionPromise) {
    initialSessionPromise = (async () => {
      try {
        const refreshed = await authApi.refresh();
        setAccessToken(refreshed.access_token);
        return await authApi.me();
      } catch {
        setAccessToken(null);
        return null;
      }
    })();
  }
  return initialSessionPromise;
}

export function invalidateSessionBootstrapCache() {
  initialSessionPromise = null;
}
