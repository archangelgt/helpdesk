import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Building2,
  Home,
  Layers,
  ListTodo,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Ticket,
} from "lucide-react";
import { LANGUAGES, type Language } from "../i18n";
import { THEMES, type Theme, usePreferences } from "../theme/preferences";

const NAV = [
  { to: "/", key: "home", icon: Home, end: true },
  { to: "/tickets", key: "tickets", icon: Ticket },
  { to: "/tareas", key: "tasks", icon: ListTodo },
  { to: "/implementaciones", key: "implementations", icon: Layers },
  { to: "/clientes", key: "clients", icon: Building2 },
  { to: "/reportes", key: "reports", icon: BarChart3 },
  { to: "/chat", key: "chat", icon: MessageSquare },
  { to: "/configuracion", key: "settings", icon: Settings },
] as const;

const LANGUAGE_NAMES: Record<Language, string> = { es: "Español", en: "English", pt: "Português" };

export function Layout() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, mode, toggleMode } = usePreferences();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo">HD</span>
          <span className="brand-text">{t("app.name")}</span>
        </div>
        <nav>
          {NAV.map(({ to, key, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} end={"end" in rest} className="nav-item">
              <Icon size={18} aria-hidden="true" />
              <span>{t(`nav.${key}`)}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <label className="search">
            <Search size={16} aria-hidden="true" />
            <input type="search" placeholder={t("app.search")} aria-label={t("app.search")} />
          </label>
          <div className="topbar-tools">
            <select
              aria-label={t("app.language")}
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
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
            <span className="avatar" aria-hidden="true">
              SS
            </span>
          </div>
        </header>
        <div className="preview-banner">{t("app.preview")}</div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
