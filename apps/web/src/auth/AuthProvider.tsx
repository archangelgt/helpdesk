import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import i18n from "../i18n";
import { api, authApi, refreshSession, setSessionLostHandler } from "../api/client";
import { applyAppearance, resolveMode } from "../theme/preferences";
import type { CurrentUser, PreferencesPatch } from "../types/auth";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  savePreferences: (patch: PreferencesPatch) => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyUserPreferences(user: CurrentUser) {
  applyAppearance(user.theme, resolveMode(user.colorMode));
  if (i18n.language !== user.language) void i18n.changeLanguage(user.language);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const startSession = useCallback((u: CurrentUser) => {
    applyUserPreferences(u);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const endSession = useCallback(() => {
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    setSessionLostHandler(endSession);
    let active = true;
    refreshSession().then((session) => {
      if (!active) return;
      if (session) startSession(session.user);
      else endSession();
    });
    return () => {
      active = false;
    };
  }, [startSession, endSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login(email, password);
      startSession(session.user);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    endSession();
  }, [endSession]);

  const savePreferences = useCallback((patch: PreferencesPatch) => {
    api<CurrentUser>("/me/preferences", { method: "PATCH", body: JSON.stringify(patch) })
      .then(setUser)
      .catch(() => undefined);
  }, []);

  const can = useCallback((permission: string) => user?.permissions.includes(permission) ?? false, [user]);

  const value = useMemo(
    () => ({ status, user, login, logout, savePreferences, can }),
    [status, user, login, logout, savePreferences, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
