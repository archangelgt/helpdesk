import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Building2, CalendarDays, CheckCircle2, Mail, Palette, Trash2, XCircle } from "lucide-react";
import { adminApi, settingsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading, NoAccess } from "../../components/Feedback";
import { useAction, useApi } from "../../hooks/useApi";
import { useInstance } from "../../instance/InstanceProvider";
import type { InstanceSettingsValues, LanguageCode, NotificationsStatusDto, SettingsDto, ThemeName, Weekday } from "../../types/api";
import { formatDate, formatDateTime } from "../../utils/dates";

const TABS = [
  { key: "general", icon: Building2 },
  { key: "appearance", icon: Palette },
  { key: "email", icon: Mail },
  { key: "notifications", icon: Bell },
  { key: "calendar", icon: CalendarDays },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const THEMES: ThemeName[] = ["blue", "orange", "green", "purple", "pink", "slate"];
const LANGS: { code: LanguageCode; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];
const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const STATUS_PILL: Record<NotificationsStatusDto["recent"][number]["status"], string> = {
  sent: "ok",
  pending: "info",
  failed: "danger",
  skipped: "muted",
};

function timezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf?.("timeZone") ?? ["America/Guatemala", "America/Mexico_City", "America/Bogota", "America/Lima", "America/Sao_Paulo", "UTC"];
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`check-item ${ok ? "ok" : "bad"}`}>
      {ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />} {label}
    </li>
  );
}

function SaveRow({ busy, error, saved, disabled }: { busy: boolean; error: string | null; saved: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="success-note">{t("settings.saved")}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary-sm" disabled={busy || disabled}>
          {t("common.save")}
        </button>
      </div>
    </>
  );
}

/** Formulario de un grupo de valores: guarda solo lo que cambió. */
function useValuesForm(data: SettingsDto, onSaved: (d: SettingsDto) => void, keys: (keyof InstanceSettingsValues)[]) {
  const pick = () => Object.fromEntries(keys.map((k) => [k, data.values[k]])) as Partial<InstanceSettingsValues>;
  const [form, setForm] = useState(pick);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const { reload } = useInstance();
  useEffect(() => setForm(pick()), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = keys.some((k) => JSON.stringify(form[k]) !== JSON.stringify(data.values[k]));
  const submit = async () => {
    setSaved(false);
    const patch = Object.fromEntries(keys.filter((k) => JSON.stringify(form[k]) !== JSON.stringify(data.values[k])).map((k) => [k, form[k]]));
    const res = await action.run(() => settingsApi.update(patch));
    if (res) {
      onSaved(res);
      setSaved(true);
      reload();
    }
  };
  return { form, set: (patch: Partial<InstanceSettingsValues>) => (setSaved(false), setForm((f) => ({ ...f, ...patch }))), submit, dirty, saved, action };
}

function Card({ title, icon, children, lead }: { title: string; icon?: ReactNode; children: ReactNode; lead?: string }) {
  return (
    <section className="card form-card">
      <div>
        <h2 className="card-title with-icon">
          {icon} {title}
        </h2>
        {lead && <p className="hint">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function GeneralTab({ data, onSaved }: { data: SettingsDto; onSaved: (d: SettingsDto) => void }) {
  const { t } = useTranslation();
  const company = useValuesForm(data, onSaved, ["companyName", "timezone"]);
  const files = useValuesForm(data, onSaved, ["maxUploadMb"]);
  return (
    <>
      <Card title={t("settings.general.title")} lead={t("settings.general.lead")}>
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            void company.submit();
          }}
        >
          <div className="form-grid">
            <label className="field">
              {t("settings.general.companyName")}
              <input value={company.form.companyName ?? ""} onChange={(e) => company.set({ companyName: e.target.value })} required maxLength={120} />
            </label>
            <label className="field">
              {t("settings.general.timezone")}
              <select value={company.form.timezone ?? ""} onChange={(e) => company.set({ timezone: e.target.value })}>
                {timezones().map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <SaveRow busy={company.action.busy} error={company.action.error} saved={company.saved} disabled={!company.dirty || !company.form.companyName?.trim()} />
        </form>
      </Card>
      <Card title={t("settings.files.title")} lead={t("settings.files.lead")}>
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            void files.submit();
          }}
        >
          <label className="field narrow-field">
            {t("settings.files.maxUpload")}
            <input
              type="number"
              min={1}
              max={25}
              value={files.form.maxUploadMb ?? 25}
              onChange={(e) => files.set({ maxUploadMb: Math.max(1, Math.min(25, Number(e.target.value) || 1)) })}
            />
            <span className="hint">{t("settings.files.maxHint")}</span>
          </label>
          <SaveRow busy={files.action.busy} error={files.action.error} saved={files.saved} disabled={!files.dirty} />
        </form>
      </Card>
    </>
  );
}

function AppearanceTab({ data, onSaved }: { data: SettingsDto; onSaved: (d: SettingsDto) => void }) {
  const { t } = useTranslation();
  const f = useValuesForm(data, onSaved, ["theme", "colorMode", "brandColor", "defaultLanguage", "languages"]);
  const languages = f.form.languages ?? [];
  return (
    <Card title={t("settings.appearance.title")} lead={t("settings.appearance.lead")}>
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          void f.submit();
        }}
      >
        <div className="field">
          {t("settings.appearance.theme")}
          <div className="swatches">
            {THEMES.map((th) => (
              <button
                key={th}
                type="button"
                className={`swatch theme-${th} ${f.form.theme === th ? "on" : ""}`}
                onClick={() => f.set({ theme: th })}
                aria-pressed={f.form.theme === th}
                title={t(`themes.${th}`)}
              >
                <span aria-hidden="true" />
                {t(`themes.${th}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            {t("settings.appearance.mode")}
            <div className="segmented">
              {(["light", "dark", "system"] as const).map((m) => (
                <button key={m} type="button" className={f.form.colorMode === m ? "on" : ""} onClick={() => f.set({ colorMode: m })}>
                  {t(`settings.appearance.modes.${m}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            {t("settings.appearance.brandColor")}
            <span className="color-field">
              <input type="color" value={f.form.brandColor ?? "#00387a"} onChange={(e) => f.set({ brandColor: e.target.value })} />
              <code>{f.form.brandColor}</code>
            </span>
            <span className="hint">{t("settings.appearance.brandHint")}</span>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            {t("settings.appearance.defaultLanguage")}
            <select value={f.form.defaultLanguage} onChange={(e) => f.set({ defaultLanguage: e.target.value as LanguageCode })}>
              {LANGS.filter((l) => languages.includes(l.code)).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            {t("settings.appearance.languages")}
            <div className="check-row">
              {LANGS.map((l) => (
                <label key={l.code} className="check">
                  <input
                    type="checkbox"
                    checked={languages.includes(l.code)}
                    disabled={languages.length === 1 && languages.includes(l.code)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...languages, l.code] : languages.filter((x) => x !== l.code);
                      f.set({ languages: next, ...(!next.includes(f.form.defaultLanguage as LanguageCode) && { defaultLanguage: next[0] }) });
                    }}
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <p className="hint">{t("settings.appearance.defaultsHint")}</p>
        <SaveRow busy={f.action.busy} error={f.action.error} saved={f.saved} disabled={!f.dirty} />
      </form>
    </Card>
  );
}

function SenderCard({ data, onSaved }: { data: SettingsDto; onSaved: (d: SettingsDto) => void }) {
  const { t } = useTranslation();
  const sender = data.sender;
  const [form, setForm] = useState({ name: sender?.name ?? "", fromEmail: sender?.fromEmail ?? "", replyTo: sender?.replyTo ?? "" });
  const [saved, setSaved] = useState(false);
  const action = useAction();
  if (!sender) return null;
  const dirty = form.name !== sender.name || form.fromEmail !== sender.fromEmail || form.replyTo !== (sender.replyTo ?? "");
  return (
    <Card title={t("settings.sender.title")} icon={<Mail size={18} aria-hidden="true" />} lead={t("settings.sender.lead")}>
      <form
        className="form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          const res = await action.run(() =>
            settingsApi.updateSender({ name: form.name.trim(), fromEmail: form.fromEmail.trim(), replyTo: form.replyTo.trim() || null }),
          );
          if (res) {
            onSaved({ ...data, sender: res });
            setSaved(true);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            {t("settings.sender.name")}
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
          </label>
          <label className="field">
            {t("settings.sender.fromEmail")}
            <input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} required maxLength={200} />
          </label>
          <label className="field">
            {t("settings.sender.replyTo")}
            <input type="email" value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} maxLength={200} placeholder={t("settings.sender.replyToNone")} />
          </label>
        </div>
        {form.fromEmail !== sender.fromEmail && <p className="hint warn-text">{t("settings.sender.domainWarning")}</p>}
        <SaveRow busy={action.busy} error={action.error} saved={saved} disabled={!dirty} />
      </form>
    </Card>
  );
}

function EmailStatus() {
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
      <h2 className="card-title">{t("settings.email.title")}</h2>
      <dl className="fields">
        <dt>{t("settings.email.sender")}</dt>
        <dd>{s.smtp.from || "—"}</dd>
        <dt>{t("settings.email.transport")}</dt>
        <dd>
          {s.smtp.transport === "api"
            ? t("settings.email.viaApi")
            : s.smtp.host
              ? `${t("settings.email.viaSmtp")} · ${s.smtp.host}:${s.smtp.port} (${s.smtp.secure ? "SSL/TLS" : "STARTTLS"})`
              : "—"}
        </dd>
        {s.smtp.transport === "smtp" && (
          <>
            <dt>{t("settings.email.user")}</dt>
            <dd>{s.smtp.user || "—"}</dd>
          </>
        )}
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

function NotificationsTab({ data, onSaved }: { data: SettingsDto; onSaved: (d: SettingsDto) => void }) {
  const { t } = useTranslation();
  const action = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  const save = async (id: string, body: Parameters<typeof settingsApi.updateRule>[1]) => {
    setBusyId(id);
    const rules = await action.run(() => settingsApi.updateRule(id, body));
    setBusyId(null);
    if (rules) onSaved({ ...data, rules });
  };
  return (
    <Card title={t("settings.rules.title")} icon={<Bell size={18} aria-hidden="true" />} lead={t("settings.rules.lead")}>
      {action.error && <p className="form-error">{action.error}</p>}
      <div className="table-card">
        <table className="table rules-table">
          <thead>
            <tr>
              <th>{t("settings.rules.event")}</th>
              {data.recipientKinds.map((k) => (
                <th key={k} className="center" title={t(`settings.recipients.${k}Hint`)}>
                  {t(`settings.recipients.${k}`)}
                </th>
              ))}
              <th className="center">{t("settings.rules.active")}</th>
            </tr>
          </thead>
          <tbody>
            {data.rules.map((rule) => (
              <tr key={rule.id} className={rule.active ? "" : "inactive"}>
                <td>
                  {t(`events.${rule.event}`, { defaultValue: rule.event })}
                  {rule.clientVisible && <span className="pill client tiny">{t("settings.rules.clientVisible")}</span>}
                </td>
                {data.recipientKinds.map((k) => (
                  <td key={k} className="center">
                    <input
                      type="checkbox"
                      className="task-check"
                      checked={rule.recipients.includes(k)}
                      disabled={busyId === rule.id}
                      aria-label={`${t(`events.${rule.event}`, { defaultValue: rule.event })}: ${t(`settings.recipients.${k}`)}`}
                      onChange={(e) =>
                        void save(rule.id, { recipients: e.target.checked ? [...rule.recipients, k] : rule.recipients.filter((x) => x !== k) })
                      }
                    />
                  </td>
                ))}
                <td className="center">
                  <label className="switch">
                    <input type="checkbox" checked={rule.active} disabled={busyId === rule.id} onChange={(e) => void save(rule.id, { active: e.target.checked })} />
                    <span aria-hidden="true" />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">{t("settings.rules.footnote")}</p>
    </Card>
  );
}

function CalendarTab({ data, onSaved }: { data: SettingsDto; onSaved: (d: SettingsDto) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const calendar = data.calendar;
  const [days, setDays] = useState<Weekday[]>(calendar?.workingDays ?? []);
  const [holiday, setHoliday] = useState({ day: "", name: "" });
  const [saved, setSaved] = useState(false);
  const daysAction = useAction();
  const holidayAction = useAction();
  useEffect(() => setDays(calendar?.workingDays ?? []), [calendar]);
  if (!calendar) return <p className="muted">{t("settings.calendar.none")}</p>;
  const update = (c: typeof calendar) => onSaved({ ...data, calendar: c });
  const dirty = JSON.stringify([...days].sort()) !== JSON.stringify([...calendar.workingDays].sort());
  const year = new Date().getFullYear();
  const upcoming = calendar.holidays.filter((h) => Number(h.day.slice(0, 4)) >= year);

  return (
    <>
      <Card title={t("settings.calendar.title")} icon={<CalendarDays size={18} aria-hidden="true" />} lead={t("settings.calendar.lead")}>
        <form
          className="form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaved(false);
            const res = await daysAction.run(() => settingsApi.setWorkingDays(WEEKDAYS.filter((d) => days.includes(d))));
            if (res) {
              update(res);
              setSaved(true);
            }
          }}
        >
          <div className="weekday-row">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`weekday ${days.includes(d) ? "on" : ""}`}
                aria-pressed={days.includes(d)}
                onClick={() => (setSaved(false), setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]))}
              >
                {t(`settings.calendar.days.${d}`)}
              </button>
            ))}
          </div>
          <SaveRow busy={daysAction.busy} error={daysAction.error} saved={saved} disabled={!dirty || days.length === 0} />
        </form>
      </Card>

      <Card title={t("settings.calendar.holidays")} lead={t("settings.calendar.holidaysLead")}>
        <form
          className="inline-add test-mail"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await holidayAction.run(() => settingsApi.addHoliday(holiday.day, holiday.name.trim()));
            if (res) {
              update(res);
              setHoliday({ day: "", name: "" });
            }
          }}
        >
          <label className="field narrow-field">
            {t("settings.calendar.day")}
            <input type="date" value={holiday.day} onChange={(e) => setHoliday({ ...holiday, day: e.target.value })} required />
          </label>
          <label className="field">
            {t("settings.calendar.holidayName")}
            <input value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} required maxLength={120} />
          </label>
          <button type="submit" className="btn btn-primary-sm" disabled={holidayAction.busy || !holiday.day || !holiday.name.trim()}>
            {t("settings.calendar.add")}
          </button>
        </form>
        {holidayAction.error && <p className="form-error">{holidayAction.error}</p>}
        {upcoming.length === 0 ? (
          <p className="muted small">{t("settings.calendar.noHolidays")}</p>
        ) : (
          <ul className="holiday-list">
            {upcoming.map((h) => (
              <li key={h.id}>
                <span className="nowrap">{formatDate(h.day, lang)}</span>
                <span>{h.name}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("settings.calendar.remove", { name: h.name })}
                  title={t("settings.calendar.remove", { name: h.name })}
                  onClick={async () => {
                    const res = await holidayAction.run(() => settingsApi.removeHoliday(h.id));
                    if (res) update(res);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const allowed = can("settings.manage");
  const settings = useApi(() => (allowed ? settingsApi.get() : Promise.resolve(undefined)), [allowed]);
  const tab = (TABS.some((x) => x.key === params.get("tab")) ? params.get("tab") : "general") as TabKey;
  if (!allowed) return <NoAccess section="settings" />;
  const data = settings.data;
  const onSaved = (d: SettingsDto) => settings.setData(d);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("nav.settings")}</h1>
        <p className="muted">{t("settings.lead")}</p>
      </header>
      <div className="tabs settings-tabs" role="tablist">
        {TABS.map(({ key, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setParams({ tab: key }, { replace: true })}>
            <Icon size={15} aria-hidden="true" /> {t(`settings.tabs.${key}`)}
          </button>
        ))}
      </div>
      {settings.error && <ErrorNote error={settings.error} onRetry={settings.reload} />}
      {!data && !settings.error && <Loading />}
      {data && tab === "general" && <GeneralTab data={data} onSaved={onSaved} />}
      {data && tab === "appearance" && <AppearanceTab data={data} onSaved={onSaved} />}
      {data && tab === "email" && (
        <>
          <SenderCard key={data.sender?.id} data={data} onSaved={onSaved} />
          <EmailStatus />
        </>
      )}
      {data && tab === "notifications" && <NotificationsTab data={data} onSaved={onSaved} />}
      {data && tab === "calendar" && <CalendarTab data={data} onSaved={onSaved} />}
    </div>
  );
}
