import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import i18n from "../i18n";
import { settingsApi } from "../api/endpoints";
import { applyAppearance, resolveMode, storedAppearance } from "../theme/preferences";
import type { PublicSettingsDto } from "../types/api";

const FALLBACK: PublicSettingsDto = {
  companyName: "",
  theme: "blue",
  colorMode: "system",
  defaultLanguage: "es",
  languages: ["es", "en", "pt"],
  maxUploadMb: 25,
};

interface InstanceContextValue {
  settings: PublicSettingsDto;
  reload: () => void;
}

const InstanceContext = createContext<InstanceContextValue>({ settings: FALLBACK, reload: () => undefined });

/** Nombre de la empresa y valores por defecto; se aplican mientras el usuario no elija los suyos. */
export function InstanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettingsDto>(FALLBACK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    settingsApi
      .publicSettings()
      .then((s) => {
        setSettings(s);
        const stored = storedAppearance();
        if (!stored.theme || !stored.mode) applyAppearance(stored.theme ?? s.theme, stored.mode ?? resolveMode(s.colorMode));
        if (!localStorage.getItem("hd2-lang") && i18n.language !== s.defaultLanguage) void i18n.changeLanguage(s.defaultLanguage);
        if (s.companyName) document.title = s.companyName;
      })
      .catch(() => undefined);
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const value = useMemo(() => ({ settings, reload }), [settings, reload]);
  return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>;
}

export function useInstance(): InstanceContextValue {
  return useContext(InstanceContext);
}
