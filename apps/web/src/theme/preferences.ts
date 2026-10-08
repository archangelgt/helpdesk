import { useCallback, useState } from "react";

export const THEMES = ["blue", "orange", "green", "purple", "pink", "slate"] as const;
export type Theme = (typeof THEMES)[number];
export type Mode = "light" | "dark";

const root = document.documentElement;
const key = (k: string) => `hd2-${k}`;

/** "system" = lo que tenga el sistema operativo del usuario. */
export function resolveMode(mode: Mode | "system" | null | undefined): Mode {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Tema y modo guardados en este navegador (null si nunca se eligieron). */
export function storedAppearance(): { theme: Theme | null; mode: Mode | null } {
  const theme = localStorage.getItem(key("theme"));
  const mode = localStorage.getItem(key("mode"));
  return {
    theme: (THEMES as readonly string[]).includes(theme ?? "") ? (theme as Theme) : null,
    mode: mode === "light" || mode === "dark" ? mode : null,
  };
}

/** Aplica tema y modo al documento sin pasar por React (p. ej. al restaurar la sesión). */
export function applyAppearance(theme: Theme, mode: Mode) {
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  localStorage.setItem(key("theme"), theme);
  localStorage.setItem(key("mode"), mode);
}

export function usePreferences(onChange?: (patch: { theme?: Theme; colorMode?: Mode }) => void) {
  const [theme, setThemeState] = useState<Theme>((root.dataset.theme as Theme) || "blue");
  const [mode, setModeState] = useState<Mode>((root.dataset.mode as Mode) || "light");

  const setTheme = useCallback(
    (t: Theme) => {
      root.dataset.theme = t;
      localStorage.setItem(key("theme"), t);
      setThemeState(t);
      onChange?.({ theme: t });
    },
    [onChange],
  );

  const toggleMode = useCallback(() => {
    const next: Mode = root.dataset.mode === "dark" ? "light" : "dark";
    root.dataset.mode = next;
    localStorage.setItem(key("mode"), next);
    setModeState(next);
    onChange?.({ colorMode: next });
  }, [onChange]);

  return { theme, setTheme, mode, toggleMode };
}
