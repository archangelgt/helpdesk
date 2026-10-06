import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { adminApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading } from "../../components/Feedback";
import { useAction, useApi } from "../../hooks/useApi";
import type { NotificationsStatusDto } from "../../types/api";
import { formatDateTime } from "../../utils/dates";
import { ComingSoonPage } from "../../pages/ComingSoonPage";

const STATUS_PILL: Record<NotificationsStatusDto["recent"][number]["status"], string> = {
  sent: "ok",
  pending: "info",
  failed: "danger",
  skipped: "muted",
};

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`check-item ${ok ? "ok" : "bad"}`}>
      {ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />} {label}
    </li>
  );
}

function EmailSettings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.resolvedLanguage ?? "es";
  const status = useApi(() => adminApi.notificationsStatus(), []);
  const test = useAction();
  const [to, setTo] = useState(user?.email ?? "");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  if (status.error) return <ErrorNote error={status.error} onRetry={status.reload} />;
  if (!status.data) return <Loading />;
  const s = status.data;

  return (
    <section className="card form-card">
      <h2 className="card-title with-icon">
        <Mail size={18} aria-hidden="true" /> {t("settings.email.title")}
      </h2>
      <dl className="fields">
        <dt>{t("settings.email.sender")}</dt>
        <dd>{s.smtp.from || "—"}</dd>
        <dt>{t("settings.email.server")}</dt>
        <dd>{s.smtp.host ? `${s.smtp.host}:${s.smtp.port} (${s.smtp.secure ? "SSL/TLS" : "STARTTLS"})` : "—"}</dd>
        <dt>{t("settings.email.user")}</dt>
        <dd>{s.smtp.user || "—"}</dd>
      </dl>
      <ul className="check-list">
        <Check ok={s.smtp.ready} label={s.smtp.ready ? t("settings.email.ready") : t("settings.email.notReady")} />
        <Check ok={s.emailChannelActive} label={t("settings.email.channel")} />
        <Check ok={Boolean(s.sender?.spfOk)} label={t("settings.email.spf")} />
        <Check ok={Boolean(s.sender?.dkimOk)} label={t("settings.email.dkim")} />
      </ul>
      {!s.smtp.ready && <p className="hint">{t("settings.email.howTo")}</p>}

      <div className="counters small-counters">
        {(["sent", "pending", "failed", "skipped"] as const).map((k) => (
          <div key={k} className={`counter ${k}`}>
            <span className="counter-value">{s.notifications[k]}</span>
            <span className="counter-label">{t(`settings.email.counts.${k}`)}</span>
          </div>
        ))}
      </div>

      <form
        className="inline-add test-mail"
        onSubmit={async (e) => {
          e.preventDefault();
          setResult(null);
          const res = await test.run(() => adminApi.sendTestEmail(to.trim()));
          if (res) setResult(res);
          status.reload();
        }}
      >
        <label className="field">
          {t("settings.email.testTo")}
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary-sm" disabled={test.busy || !to.trim()}>
          {test.busy ? t("settings.email.sending") : t("settings.email.sendTest")}
        </button>
      </form>
      {test.error && <p className="form-error">{test.error}</p>}
      {result && (result.ok ? <p className="success-note">{t("settings.email.testOk")}</p> : <p className="form-error">{t("settings.email.testFailed", { error: result.error })}</p>)}

      <h3 className="mini-title">{t("settings.email.recent")}</h3>
      {s.recent.length === 0 ? (
        <p className="muted small">{t("settings.email.noRecent")}</p>
      ) : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settings.email.when")}</th>
                <th>{t("settings.email.to")}</th>
                <th>{t("settings.email.subject")}</th>
                <th>{t("work.fields.status")}</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((n) => (
                <tr key={n.id}>
                  <td className="muted small nowrap">{formatDateTime(n.created, lang)}</td>
                  <td className="small">{n.to}</td>
                  <td className="small">{n.subject}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[n.status]}`} title={n.error || undefined}>
                      {t(`settings.email.status.${n.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  if (!can("settings.manage")) return <ComingSoonPage section="settings" phase={1} />;
  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("nav.settings")}</h1>
        <p className="muted">{t("settings.lead")}</p>
      </header>
      <EmailSettings />
    </div>
  );
}
