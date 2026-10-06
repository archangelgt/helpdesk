import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthProvider";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (status === "loading") {
    return (
      <div className="splash" role="status">
        <span className="logo">HD</span>
        <span className="muted">{t("auth.loading")}</span>
      </div>
    );
  }
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
