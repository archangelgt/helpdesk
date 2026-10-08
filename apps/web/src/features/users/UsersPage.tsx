import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Copy, KeyRound, Plus, Search, UserCheck, UserX, X } from "lucide-react";
import { adminApi, usersApi, type UserQuery } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading, NoAccess } from "../../components/Feedback";
import { Pill, type PillTone } from "../../components/Progress";
import { useAction, useApi } from "../../hooks/useApi";
import type { AccessResult, AdminUserDetailDto, AdminUserDto, ClientDto, RoleOption } from "../../types/api";
import { formatDateTime } from "../../utils/dates";
import { EMPTY_USER, UserFields, type UserFormValue } from "./UserForm";

const STATUS_TONE: Record<AdminUserDto["status"], PillTone> = { active: "ok", invited: "info", suspended: "danger" };

function initials(name: string, email: string): string {
  const parts = (name || email).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function toBody(v: UserFormValue, roles: RoleOption[]) {
  const scope = roles.find((r) => r.id === v.roleId)?.scope;
  return {
    name: v.name.trim(),
    email: v.email.trim(),
    phone: v.phone.trim(),
    roleId: v.roleId,
    clientId: scope === "client" ? v.clientId || null : null,
    language: v.language || null,
    ...(scope === "client" && { receivesNotifications: v.receivesNotifications }),
  };
}

function fromUser(u: AdminUserDto): UserFormValue {
  return {
    name: u.name,
    email: u.email,
    phone: u.phone ?? "",
    roleId: u.role?.id ?? "",
    clientId: u.client?.id ?? "",
    language: u.language ?? "",
    receivesNotifications: u.receivesNotifications,
  };
}

/** Contraseña temporal recién generada: se muestra una sola vez para copiarla. */
function AccessNote({ result, email, onClose }: { result: AccessResult; email: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="access-note">
      <button type="button" className="icon-btn close" onClick={onClose} aria-label={t("common.close")}>
        <X size={16} />
      </button>
      {result.temporaryPassword && (
        <>
          <p className="small">{t("users.tempPasswordLead", { email })}</p>
          <div className="temp-password">
            <code>{result.temporaryPassword}</code>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                void navigator.clipboard?.writeText(result.temporaryPassword ?? "");
                setCopied(true);
              }}
            >
              <Copy size={14} aria-hidden="true" /> {copied ? t("users.copied") : t("users.copy")}
            </button>
          </div>
          <p className="hint">{t("users.tempPasswordHint")}</p>
        </>
      )}
      {result.emailSent && <p className="success-note">{t("users.accessEmailSent", { email })}</p>}
      {result.emailError && <p className="form-error">{t("users.accessEmailFailed", { error: result.emailError })}</p>}
    </div>
  );
}

function CreateUser({ roles, clients, defaultClientId, onCreated, onCancel }: {
  roles: RoleOption[];
  clients: ClientDto[];
  defaultClientId: string;
  onCreated: (user: AdminUserDetailDto, result: AccessResult) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const clientRole = roles.find((r) => r.code === "client_user");
  const [form, setForm] = useState<UserFormValue>({
    ...EMPTY_USER,
    ...(defaultClientId && clientRole && { roleId: clientRole.id, clientId: defaultClientId }),
  });
  const [ownPassword, setOwnPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [sendWelcome, setSendWelcome] = useState(true);
  const create = useAction();

  return (
    <form
      className="card form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await create.run(() =>
          usersApi.create({ ...toBody(form, roles), ...(ownPassword && { password }), sendWelcome }),
        );
        if (res) onCreated(res.user, res);
      }}
    >
      <h2 className="card-title">{t("users.new")}</h2>
      <UserFields value={form} onChange={setForm} roles={roles} clients={clients} />
      <div className="form-grid">
        <div className="field">
          {t("users.password")}
          <div className="segmented">
            <button type="button" className={!ownPassword ? "on" : ""} onClick={() => setOwnPassword(false)}>
              {t("users.passwordGenerate")}
            </button>
            <button type="button" className={ownPassword ? "on" : ""} onClick={() => setOwnPassword(true)}>
              {t("users.passwordWrite")}
            </button>
          </div>
          {ownPassword && (
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} maxLength={72} required autoComplete="new-password" />
          )}
          <span className="hint">{ownPassword ? t("users.passwordRules") : t("users.passwordGenerateHint")}</span>
        </div>
        <label className="check">
          <input type="checkbox" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
          <span>
            {t("users.sendWelcome")}
            <span className="hint block">{t("users.sendWelcomeHint")}</span>
          </span>
        </label>
      </div>
      {create.error && <p className="form-error">{create.error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary-sm" disabled={create.busy || !form.name.trim() || !form.email.trim() || !form.roleId}>
          {t("users.create")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

function UserPanel({ id, roles, clients, onChanged, onClose }: {
  id: string;
  roles: RoleOption[];
  clients: ClientDto[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const { user: me } = useAuth();
  const detail = useApi(() => usersApi.get(id), [id]);
  const [form, setForm] = useState<UserFormValue>(EMPTY_USER);
  const [sendEmail, setSendEmail] = useState(true);
  const [access, setAccess] = useState<AccessResult | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const action = useAction();

  useEffect(() => {
    if (detail.data) setForm(fromUser(detail.data));
  }, [detail.data]);
  useEffect(() => {
    setAccess(null);
    setSaved(false);
  }, [id]);

  if (detail.error) return <ErrorNote error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <Loading />;
  const u = detail.data;
  const isMe = u.id === me?.id;
  const ownerLocked = u.role?.code === "owner" && !roles.some((r) => r.code === "owner");
  const update = async (body: Parameters<typeof usersApi.update>[1], runner = save) => {
    setSaved(false);
    const res = await runner.run(() => usersApi.update(u.id, body));
    if (res) {
      detail.setData(res);
      setSaved(runner === save);
      onChanged();
    }
  };

  return (
    <section className="card user-panel">
      <div className="card-head">
        <div className="user-head">
          <span className="avatar lg" aria-hidden="true">
            {initials(u.name, u.email)}
          </span>
          <div>
            <h2 className="card-title">{u.name || u.email}</h2>
            <p className="muted small">{u.email}</p>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
          <X size={18} />
        </button>
      </div>

      <dl className="fields compact-fields">
        <dt>{t("users.fields.status")}</dt>
        <dd>
          <Pill tone={STATUS_TONE[u.status]}>{t(`users.status.${u.status}`)}</Pill>
        </dd>
        <dt>{t("users.fields.role")}</dt>
        <dd>{u.role ? t(`role.${u.role.code}`, { defaultValue: u.role.name }) : "—"}</dd>
        <dt>{t("users.fields.client")}</dt>
        <dd>{u.client?.name ?? t("users.internal")}</dd>
        <dt>{t("users.lastSeen")}</dt>
        <dd>{u.lastSeenAt ? formatDateTime(u.lastSeenAt, lang) : t("users.never")}</dd>
        <dt>{t("users.createdAt")}</dt>
        <dd>{formatDateTime(u.created, lang)}</dd>
        <dt>{t("users.sessions")}</dt>
        <dd>{u.activeSessions}</dd>
        <dt>{u.role?.scope === "client" ? t("users.requested") : t("users.openAssigned")}</dt>
        <dd>{u.role?.scope === "client" ? u.requested : u.openAssigned}</dd>
      </dl>

      {ownerLocked ? (
        <p className="hint">{t("users.ownerOnly")}</p>
      ) : (
        <>
          <form
            className="form-card edit-user"
            onSubmit={async (e) => {
              e.preventDefault();
              await update(toBody(form, roles));
            }}
          >
            <h3 className="mini-title">{t("users.edit")}</h3>
            <UserFields value={form} onChange={setForm} roles={roles} clients={clients} lockRole={isMe} />
            {save.error && <p className="form-error">{save.error}</p>}
            {saved && <p className="success-note">{t("users.saved")}</p>}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary-sm" disabled={save.busy || !form.name.trim() || !form.email.trim() || !form.roleId}>
                {t("common.save")}
              </button>
            </div>
          </form>

          {!isMe && (
            <div className="user-actions">
              <h3 className="mini-title">{t("users.access")}</h3>
              <label className="check">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                {t("users.resetSendEmail")}
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-soft"
                  disabled={action.busy}
                  onClick={async () => {
                    if (!window.confirm(t("users.resetConfirm", { name: u.name || u.email }))) return;
                    const res = await action.run(() => usersApi.resetPassword(u.id, sendEmail));
                    if (res) {
                      setAccess(res);
                      detail.reload();
                    }
                  }}
                >
                  <KeyRound size={14} aria-hidden="true" /> {t("users.resetPassword")}
                </button>
                {u.status === "suspended" ? (
                  <button type="button" className="btn btn-ok" disabled={action.busy} onClick={() => void update({ status: "active" }, action)}>
                    <UserCheck size={14} aria-hidden="true" /> {t("users.reactivate")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={action.busy}
                    onClick={() => {
                      if (window.confirm(t("users.suspendConfirm", { name: u.name || u.email }))) void update({ status: "suspended" }, action);
                    }}
                  >
                    <UserX size={14} aria-hidden="true" /> {t("users.suspend")}
                  </button>
                )}
              </div>
              {action.error && <p className="form-error">{action.error}</p>}
              {access && <AccessNote result={access} email={u.email} onClose={() => setAccess(null)} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const filters: UserQuery = {
    q: q.trim() || undefined,
    scope: (params.get("scope") as UserQuery["scope"]) || undefined,
    roleId: params.get("roleId") || undefined,
    clientId: params.get("clientId") || undefined,
    status: (params.get("status") as UserQuery["status"]) || undefined,
  };
  const allowed = can("user.manage");
  const list = useApi(() => (allowed ? usersApi.list(filters) : Promise.resolve([])), [allowed, JSON.stringify(filters)]);
  const roles = useApi(() => (allowed ? usersApi.roles() : Promise.resolve([])), [allowed]);
  const clients = useApi(() => (allowed ? adminApi.clients() : Promise.resolve([])), [allowed]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; result: AccessResult } | null>(null);
  const selected = params.get("id");

  if (!allowed) return <NoAccess section="users" />;

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "scope") next.delete("roleId");
    setParams(next, { replace: true });
  };
  const select = (id: string | null) => setFilter("id", id ?? "");
  const roleOptions = (roles.data ?? []).filter((r) => !filters.scope || r.scope === filters.scope);

  return (
    <div className="stack">
      <header className="page-head row">
        <div>
          <h1>{t("nav.users")}</h1>
          <p className="muted">{t("users.lead")}</p>
        </div>
        {!creating && (
          <button type="button" className="btn btn-primary-sm" onClick={() => setCreating(true)} disabled={!roles.data || !clients.data}>
            <Plus size={16} aria-hidden="true" /> {t("users.new")}
          </button>
        )}
      </header>

      {creating && roles.data && clients.data && (
        <CreateUser
          roles={roles.data}
          clients={clients.data}
          defaultClientId={filters.clientId ?? ""}
          onCancel={() => setCreating(false)}
          onCreated={(user, result) => {
            setCreating(false);
            setCreated({ email: user.email, result });
            list.reload();
            select(user.id);
          }}
        />
      )}
      {created && (created.result.temporaryPassword || created.result.emailSent || created.result.emailError) && (
        <section className="card">
          <h2 className="card-title">{t("users.createdTitle")}</h2>
          <AccessNote result={created.result} email={created.email} onClose={() => setCreated(null)} />
        </section>
      )}

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {(["", "staff", "client"] as const).map((scope) => (
            <button key={scope || "all"} type="button" role="tab" aria-selected={(filters.scope ?? "") === scope} className={(filters.scope ?? "") === scope ? "on" : ""} onClick={() => setFilter("scope", scope)}>
              {t(`users.scopeTabs.${scope || "all"}`)}
            </button>
          ))}
        </div>
        <select className="filter-select" value={filters.roleId ?? ""} onChange={(e) => setFilter("roleId", e.target.value)} aria-label={t("users.fields.role")}>
          <option value="">{t("users.allRoles")}</option>
          {roleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`role.${r.code}`, { defaultValue: r.name })}
            </option>
          ))}
        </select>
        {filters.scope !== "staff" && (
          <select className="filter-select" value={filters.clientId ?? ""} onChange={(e) => setFilter("clientId", e.target.value)} aria-label={t("users.fields.client")}>
            <option value="">{t("users.allClients")}</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select className="filter-select" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)} aria-label={t("users.fields.status")}>
          <option value="">{t("users.allStatuses")}</option>
          {(["active", "invited", "suspended"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`users.status.${s}`)}
            </option>
          ))}
        </select>
        <label className="search-box">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("users.search")} aria-label={t("users.search")} />
        </label>
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      <div className={selected ? "detail-grid users-grid" : ""}>
        {list.data && (
          <section className="card table-card">
            {list.data.length === 0 ? (
              <p className="muted empty">{t("users.empty")}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("users.fields.name")}</th>
                    <th>{t("users.fields.role")}</th>
                    <th>{t("users.fields.client")}</th>
                    <th>{t("users.fields.status")}</th>
                    {!selected && <th>{t("users.lastSeen")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((u) => (
                    <tr key={u.id} className={`clickable ${u.id === selected ? "selected" : ""}`} onClick={() => select(u.id)}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar" aria-hidden="true">
                            {initials(u.name, u.email)}
                          </span>
                          <div>
                            <button type="button" className="link-btn" onClick={() => select(u.id)}>
                              {u.name || u.email}
                            </button>
                            <span className="muted small block">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="small">{u.role ? t(`role.${u.role.code}`, { defaultValue: u.role.name }) : "—"}</td>
                      <td className="small">{u.client?.name ?? <span className="muted">{t("users.internal")}</span>}</td>
                      <td>
                        <Pill tone={STATUS_TONE[u.status]}>{t(`users.status.${u.status}`)}</Pill>
                      </td>
                      {!selected && <td className="muted small nowrap">{u.lastSeenAt ? formatDateTime(u.lastSeenAt, lang) : t("users.never")}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
        {selected && roles.data && clients.data && (
          <div className="side-panel">
            <UserPanel id={selected} roles={roles.data} clients={clients.data} onChanged={list.reload} onClose={() => select(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
