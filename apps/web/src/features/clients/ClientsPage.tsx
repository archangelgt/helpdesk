import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Users } from "lucide-react";
import { adminApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading } from "../../components/Feedback";
import { Pill } from "../../components/Progress";
import { useAction, useApi } from "../../hooks/useApi";
import type { ClientDto } from "../../types/api";

interface ClientForm {
  name: string;
  legalName: string;
  taxId: string;
  status: ClientDto["status"];
  notes: string;
}

const EMPTY: ClientForm = { name: "", legalName: "", taxId: "", status: "active", notes: "" };

function ClientFormCard({ initial, onSubmit, onCancel, submitLabel, busy, error }: {
  initial: ClientForm;
  onSubmit: (form: ClientForm) => void;
  onCancel: () => void;
  submitLabel: string;
  busy: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="form-grid">
        <label className="field">
          {t("clients.name")}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={160} autoFocus />
        </label>
        <label className="field">
          {t("clients.legalName")}
          <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} maxLength={200} />
        </label>
        <label className="field">
          {t("clients.taxId")}
          <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} maxLength={40} />
        </label>
        <label className="field">
          {t("clients.status")}
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientDto["status"] })}>
            {(["active", "prospect", "inactive"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`clients.statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        {t("clients.notes")}
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={5000} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary-sm" disabled={busy || !form.name.trim()}>
          {submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

const body = (f: ClientForm) => ({
  name: f.name.trim(),
  legalName: f.legalName.trim(),
  taxId: f.taxId.trim(),
  status: f.status,
  notes: f.notes.trim(),
});

export function ClientsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const list = useApi(() => adminApi.clients(q.trim() || undefined), [q]);
  const canManage = can("client.manage");
  const canUsers = can("user.manage");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientDto | null>(null);
  const save = useAction();

  return (
    <div className="stack">
      <header className="page-head row">
        <div>
          <h1>{t("nav.clients")}</h1>
          <p className="muted">{t("clients.lead")}</p>
        </div>
        {canManage && !creating && !editing && (
          <button type="button" className="btn btn-primary-sm" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {t("clients.new")}
          </button>
        )}
      </header>

      {creating && (
        <ClientFormCard
          initial={EMPTY}
          submitLabel={t("work.create")}
          busy={save.busy}
          error={save.error}
          onCancel={() => setCreating(false)}
          onSubmit={async (f) => {
            const b = body(f);
            const client = await save.run(() =>
              adminApi.createClient({ name: b.name, ...(b.legalName && { legalName: b.legalName }), ...(b.taxId && { taxId: b.taxId }) }),
            );
            if (client) {
              setCreating(false);
              list.reload();
            }
          }}
        />
      )}
      {editing && (
        <ClientFormCard
          key={editing.id}
          initial={{ name: editing.name, legalName: editing.legalName ?? "", taxId: editing.taxId ?? "", status: editing.status, notes: editing.notes ?? "" }}
          submitLabel={t("common.save")}
          busy={save.busy}
          error={save.error}
          onCancel={() => setEditing(null)}
          onSubmit={async (f) => {
            const client = await save.run(() => adminApi.updateClient(editing.id, body(f)));
            if (client) {
              setEditing(null);
              list.reload();
            }
          }}
        />
      )}

      <div className="toolbar">
        <label className="search-box">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("clients.search")} aria-label={t("clients.search")} />
        </label>
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data && (
        <section className="card table-card">
          {list.data.length === 0 ? (
            <p className="muted empty">{t("clients.empty")}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("clients.name")}</th>
                  <th>{t("clients.legalName")}</th>
                  <th>{t("clients.taxId")}</th>
                  <th>{t("clients.status")}</th>
                  <th className="num">{t("clients.openItems")}</th>
                  <th className="num">{t("clients.users")}</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {list.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td className="muted">{c.legalName ?? "—"}</td>
                    <td className="muted">{c.taxId ?? "—"}</td>
                    <td>
                      <Pill tone={c.status === "active" ? "ok" : c.status === "prospect" ? "info" : "muted"}>{t(`clients.statuses.${c.status}`)}</Pill>
                    </td>
                    <td className="num">{c.openItems}</td>
                    <td className="num">
                      {canUsers ? (
                        <Link className="row-link icon-link-inline" to={`/usuarios?scope=client&clientId=${c.id}`} title={t("clients.manageUsers")}>
                          <Users size={14} aria-hidden="true" /> {c.userCount}
                        </Link>
                      ) : (
                        c.userCount
                      )}
                    </td>
                    {canManage && (
                      <td className="num">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            setCreating(false);
                            setEditing(c);
                          }}
                          aria-label={t("clients.edit", { name: c.name })}
                          title={t("clients.edit", { name: c.name })}
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
