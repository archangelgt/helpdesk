import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { adminApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading } from "../../components/Feedback";
import { Pill } from "../../components/Progress";
import { useAction, useApi } from "../../hooks/useApi";

export function ClientsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const list = useApi(() => adminApi.clients(q.trim() || undefined), [q]);
  const canManage = can("client.manage");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", legalName: "", taxId: "" });
  const create = useAction();

  return (
    <div className="stack">
      <header className="page-head row">
        <div>
          <h1>{t("nav.clients")}</h1>
          <p className="muted">{t("clients.lead")}</p>
        </div>
        {canManage && !creating && (
          <button type="button" className="btn btn-primary-sm" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {t("clients.new")}
          </button>
        )}
      </header>

      {creating && (
        <form
          className="card form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const client = await create.run(() =>
              adminApi.createClient({
                name: form.name.trim(),
                ...(form.legalName.trim() && { legalName: form.legalName.trim() }),
                ...(form.taxId.trim() && { taxId: form.taxId.trim() }),
              }),
            );
            if (client) {
              setCreating(false);
              setForm({ name: "", legalName: "", taxId: "" });
              list.reload();
            }
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
          </div>
          {create.error && <p className="form-error">{create.error}</p>}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary-sm" disabled={create.busy || !form.name.trim()}>
              {t("work.create")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
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
