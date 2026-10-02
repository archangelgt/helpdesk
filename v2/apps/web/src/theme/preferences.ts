import { useCallback, useState } from "react";

export const THEMES = ["blue", "orange", "green", "purple", "pink", "slate"] as const;
export type Theme = (typeof THEMES)[number];
export type Mode = "light" | "dark";

const root = document.documentElement;
const key = (k: string) => `hd2-${k}`;

export function usePreferences() {
  const [theme, setThemeState] = useState<Theme>((root.dataset.theme as Theme) || "blue");
  const [mode, setModeState] = useState<Mode>((root.dataset.mode as Mode) || "light");

  const setTheme = useCallback((t: Theme) => {
    root.dataset.theme = t;
    localStorage.setItem(key("theme"), t);
    setThemeState(t);
  }, []);

  const toggleMode = useCallback(() => {
    const next: Mode = root.dataset.mode === "dark" ? "light" : "dark";
    root.dataset.mode = next;
    localStorage.setItem(key("mode"), next);
    setModeState(next);
  }, []);

  return { theme, setTheme, mode, toggleMode };
}
