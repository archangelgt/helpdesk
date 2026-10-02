import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { workItemsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { DueLabel } from "../../components/DueLabel";
import { ErrorNote, Loading } from "../../components/Feedback";
import { PriorityLabel, StatusBadge } from "../../components/StatusBadge";
import { useAction, useApi } from "../../hooks/useApi";
import type { WorkItemView } from "../../types/api";

const VIEWS: WorkItemView[] = ["open", "waiting_client", "done", "all"];
const DONE = new Set(["resolved", "closed", "cancelled"]);

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Lista de tickets o tareas con vistas, búsqueda y alta rápida por título. */
export function WorkItemsPage({ type, section, basePath }: { type: string; section: string; basePath: string }) {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const isClient = user?.role?.scope === "client";
  const [view, setView] = useState<WorkItemView>("open");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  useEffect(() => setPage(1), [view, mine, q, type]);

  const list = useApi(
    () => workItemsApi.list({ type, view, q, page, assignee: mine ? "me" : undefined, perPage: 25 }),
    [type, view, mine, q, page],
  );

  const [title, setTitle] = useState("");
  const create = useAction();
  const canCreate = can("work_item.create") && (type === "support" || !isClient);

  return (
    <div className="stack">
      <header className="page-head row">
        <div>
          <h1>{t(`nav.${section}`)}</h1>
          <p className="muted">{t(`work.${section}Lead`)}</p>
        </div>
      </header>

      {canCreate && (
        <form
          className="card quick-create"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const item = await create.run(() => workItemsApi.create({ type, title: title.trim() }));
            if (item) navigate(`${basePath}/${item.id}`);
          }}
        >
          <Plus size={18} aria-hidden="true" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(`work.${section}NewPlaceholder`)}
            aria-label={t(`work.${section}NewPlaceholder`)}
            maxLength={200}
          />
          <button type="submit" className="btn btn-primary-sm" disabled={create.busy || !title.trim()}>
            {t("work.create")}
          </button>
          {create.error && <p className="form-error">{create.error}</p>}
        </form>
      )}

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {t(`work.views.${v}`)}
            </button>
          ))}
        </div>
        {!isClient && (
          <label className="check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t("work.onlyMine")}
          </label>
        )}
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("work.search")} aria-label={t("work.search")} />
        </label>
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data && (
        <section className="card table-card">
          {list.data.items.length === 0 ? (
            <p className="muted empty">{t("work.empty")}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("work.fields.number")}</th>
                  <th>{t("work.fields.title")}</th>
                  {!isClient && <th>{t("work.fields.client")}</th>}
                  <th>{t("work.fields.status")}</th>
                  <th>{t("work.fields.priority")}</th>
                  <th>{t("work.fields.assignee")}</th>
                  <th>{t("work.fields.due")}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="number">{item.number}</td>
                    <td>
                      <Link to={`${basePath}/${item.id}`} className="row-link">
                        {item.title}
                      </Link>
                    </td>
                    {!isClient && <td className="muted">{item.client?.name ?? "—"}</td>}
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <PriorityLabel priority={item.priority} />
                    </td>
                    <td className="muted">{item.assignee?.name ?? t("work.unassigned")}</td>
                    <td>{item.dueAt ? <DueLabel date={item.dueAt} done={DONE.has(item.status.category)} /> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {list.data.totalPages > 1 && (
            <div className="pager">
              <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t("common.previous")}
              </button>
              <span className="muted small">{t("common.pageOf", { page, total: list.data.totalPages })}</span>
              <button type="button" className="btn btn-ghost" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>
                {t("common.next")}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
