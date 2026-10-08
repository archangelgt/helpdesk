import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AppearanceControls } from "../components/AppearanceControls";
import { useInstance } from "../instance/InstanceProvider";

export function LoginPage() {
  const { t } = useTranslation();
  const { status, login } = useAuth();
  const { companyName } = useInstance().settings;
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "loading") return null;
  if (status === "authenticated") return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.networkError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-tools">
        <AppearanceControls />
      </div>
      <form className="login-card card" onSubmit={submit} noValidate>
        <div className="login-brand">
          <span className="logo">HD</span>
          <div>
            <h1>{companyName || t("app.name")}</h1>
            <p className="muted small">{t("auth.subtitle")}</p>
          </div>
        </div>

        <label className="field">
          <span>{t("auth.email")}</span>
          <input
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t("auth.password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={busy || !email || !password}>
          <LogIn size={16} aria-hidden="true" />
          {busy ? t("auth.submitting") : t("auth.submit")}
        </button>
      </form>
    </div>
  );
}
