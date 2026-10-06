import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { meApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { useAction } from "../../hooks/useApi";

const MIN_LENGTH = 10;

function PasswordForm() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [done, setDone] = useState<number | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value });
    setDone(null);
  };
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const tooShort = form.next.length > 0 && form.next.length < MIN_LENGTH;

  return (
    <form
      className="card form-card narrow"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mismatch || tooShort) return;
        const result = await run(() => meApi.changePassword(form.current, form.next));
        if (result) {
          setForm({ current: "", next: "", confirm: "" });
          setDone(result.closedSessions);
        }
      }}
    >
      <h2 className="card-title">{t("account.passwordTitle")}</h2>
      <label className="field">
        {t("account.current")}
        <input type="password" value={form.current} onChange={set("current")} autoComplete="current-password" required />
      </label>
      <label className="field">
        {t("account.new")}
        <input type="password" value={form.next} onChange={set("next")} autoComplete="new-password" minLength={MIN_LENGTH} maxLength={72} required />
        <span className="hint">{tooShort ? t("account.tooShort", { min: MIN_LENGTH }) : t("account.newHint", { min: MIN_LENGTH })}</span>
      </label>
      <label className="field">
        {t("account.confirm")}
        <input type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
        {mismatch && <span className="hint error-text">{t("account.mismatch")}</span>}
      </label>
      {error && <p className="form-error">{error}</p>}
      {done !== null && (
        <p className="success-note">
          <CheckCircle2 size={16} aria-hidden="true" /> {t("account.changed", { count: done })}
        </p>
      )}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary-sm" disabled={busy || mismatch || tooShort || !form.current || !form.next}>
          {busy ? t("account.saving") : t("account.change")}
        </button>
      </div>
    </form>
  );
}

export function AccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("account.title")}</h1>
        <p className="muted">{t("account.lead")}</p>
      </header>
      <section className="card narrow">
        <dl className="fields">
          <dt>{t("account.name")}</dt>
          <dd>{user.name || "—"}</dd>
          <dt>{t("auth.email")}</dt>
          <dd>{user.email}</dd>
          <dt>{t("account.role")}</dt>
          <dd>{user.role?.name ?? "—"}</dd>
        </dl>
      </section>
      <PasswordForm />
    </div>
  );
}
