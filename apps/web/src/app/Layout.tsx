import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Building2,
  Home,
  Layers,
  ListTodo,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { AppearanceControls } from "../components/AppearanceControls";
import { useInstance } from "../instance/InstanceProvider";

/** `perm`: el módulo solo aparece si el rol tiene ese permiso. */
const NAV: { to: string; key: string; icon: typeof Home; end?: boolean; client: boolean; perm?: string }[] = [
  { to: "/", key: "home", icon: Home, end: true, client: true },
  { to: "/tickets", key: "tickets", icon: Ticket, client: true },
  { to: "/tareas", key: "tasks", icon: ListTodo, client: false },
  { to: "/implementaciones", key: "implementations", icon: Layers, client: true },
  { to: "/clientes", key: "clients", icon: Building2, client: false },
  { to: "/usuarios", key: "users", icon: Users, client: false, perm: "user.manage" },
  { to: "/reportes", key: "reports", icon: BarChart3, client: false, perm: "report.view" },
  { to: "/chat", key: "chat", icon: MessageSquare, client: false },
  { to: "/configuracion", key: "settings", icon: Settings, client: false, perm: "settings.manage" },
];

function initials(name: string, email: string): string {
  const parts = (name || email).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Layout() {
  const { t } = useTranslation();
  const { user, logout, savePreferences, can } = useAuth();
  const { companyName } = useInstance().settings;
  const isClient = user?.role?.scope === "client";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo">HD</span>
          <span className="brand-text" title={companyName || undefined}>
            {companyName || t("app.name")}
          </span>
        </div>
        <nav>
          {NAV.filter((item) => (!isClient || item.client) && (!item.perm || can(item.perm))).map(({ to, key, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
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
            <AppearanceControls onChange={savePreferences} />
            {user && (
              <Link to="/cuenta" className="user-chip" title={`${user.name} · ${user.role?.name ?? ""} — ${t("account.title")}`}>
                <span className="avatar" aria-hidden="true">
                  {initials(user.name, user.email)}
                </span>
                <span className="user-name">{user.name || user.email}</span>
              </Link>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={() => void logout()}
              title={t("auth.logout")}
              aria-label={t("auth.logout")}
            >
              <LogOut size={18} />
            </button>
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
