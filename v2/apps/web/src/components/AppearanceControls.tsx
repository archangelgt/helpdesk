import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";
import { LANGUAGES, type Language } from "../i18n";
import { THEMES, type Mode, type Theme, usePreferences } from "../theme/preferences";

const LANGUAGE_NAMES: Record<Language, string> = { es: "Español", en: "English", pt: "Português" };

interface Props {
  onChange?: (patch: { language?: Language; theme?: Theme; colorMode?: Mode }) => void;
}

/** Selectores de idioma, tema y modo claro/oscuro (barra superior y pantalla de login). */
export function AppearanceControls({ onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, mode, toggleMode } = usePreferences(onChange);

  const changeLanguage = (lng: Language) => {
    void i18n.changeLanguage(lng);
    onChange?.({ language: lng });
  };

  return (
    <>
      <select
        aria-label={t("app.language")}
        value={i18n.resolvedLanguage}
        onChange={(e) => changeLanguage(e.target.value as Language)}
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
      <select aria-label={t("app.theme")} value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
        {THEMES.map((th) => (
          <option key={th} value={th}>
            {t(`themes.${th}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn"
        onClick={toggleMode}
        title={mode === "dark" ? t("app.lightMode") : t("app.darkMode")}
        aria-label={mode === "dark" ? t("app.lightMode") : t("app.darkMode")}
      >
        {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </>
  );
}
