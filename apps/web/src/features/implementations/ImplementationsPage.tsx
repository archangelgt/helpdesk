import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { adminApi, workItemsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading } from "../../components/Feedback";
import { useAction, useApi } from "../../hooks/useApi";
import type { WorkItemView } from "../../types/api";
import { todayDay } from "../../utils/dates";
import { ImplementationCard } from "./ImplementationCard";

const VIEWS: WorkItemView[] = ["open", "done", "all"];

function NewImplementationForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const clients = useApi(() => adminApi.clients(), []);
  const templates = useApi(() => adminApi.templates("implementation"), []);
  const users = useApi(() => adminApi.assignableUsers(), []);
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({ title: "", clientId: "", templateId: "", plannedStart: todayDay(), assigneeId: user?.id ?? "", dueAt: "" });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="card form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const item = await run(() =>
          workItemsApi.create({
            type: "implementation",
            title: form.title.trim(),
            clientId: form.clientId || null,
            templateId: form.templateId || null,
            plannedStart: form.plannedStart || null,
            assigneeId: form.assigneeId || null,
            dueAt: form.dueAt || null,
          }),
        );
        if (item) navigate(`/implementaciones/${item.id}`);
      }}
    >
      <h2 className="card-title">{t("impl.new")}</h2>
      <div className="form-grid">
        <label className="field">
          {t("work.fields.title")}
          <input value={form.title} onChange={set("title")} required maxLength={200} autoFocus />
        </label>
        <label className="field">
          {t("work.fields.client")}
          <select value={form.clientId} onChange={set("clientId")} required>
            <option value="">{t("common.choose")}</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("impl.template")}
          <select value={form.templateId} onChange={set("templateId")}>
            <option value="">{t("impl.noTemplate")}</option>
            {(templates.data ?? []).map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {t("impl.templateOption", { name: tpl.name, count: tpl.stageCount })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("impl.plannedStart")}
          <input type="date" value={form.plannedStart} onChange={set("plannedStart")} />
        </label>
        <label className="field">
          {t("work.fields.assignee")}
          <select value={form.assigneeId} onChange={set("assigneeId")}>
            <option value="">{t("work.unassigned")}</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("work.fields.due")}
          <input type="date" value={form.dueAt} onChange={set("dueAt")} />
          <span className="hint">{t("impl.dueHint")}</span>
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary-sm" disabled={busy || !form.title.trim() || !form.clientId}>
          {t("work.create")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function ImplementationsPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const [view, setView] = useState<WorkItemView>("open");
  const [creating, setCreating] = useState(false);
  const list = useApi(() => workItemsApi.list({ type: "implementation", view, perPage: 100, sort: "due_at" }), [view]);
  const canCreate = user?.role?.scope === "staff" && can("work_item.create") && can("stage.manage");

  return (
    <div className="stack">
      <header className="page-head row">
        <div>
          <h1>{t("impl.title")}</h1>
          <p className="muted">{t("impl.subtitle")}</p>
        </div>
        {canCreate && !creating && (
          <button type="button" className="btn btn-primary-sm" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {t("impl.new")}
          </button>
        )}
      </header>

      {creating && <NewImplementationForm onCancel={() => setCreating(false)} />}

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {t(`work.views.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.items.length === 0 && <p className="muted">{t("work.empty")}</p>}
      <div className="card-grid">
        {list.data?.items.map((impl) => <ImplementationCard key={impl.id} impl={impl} />)}
      </div>
    </div>
  );
}
