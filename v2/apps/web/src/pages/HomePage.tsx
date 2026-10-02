import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { workItemsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { DueLabel } from "../components/DueLabel";
import { ErrorNote } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { ImplementationCard } from "../features/implementations/ImplementationCard";
import { useApi } from "../hooks/useApi";
import { detailPath } from "../utils/paths";

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isClient = user?.role?.scope === "client";
  const summary = useApi(() => workItemsApi.summary(), []);
  const impls = useApi(() => workItemsApi.list({ type: "implementation", view: "open", perPage: 12, sort: "due_at" }), []);
  const mine = useApi(
    () =>
      isClient
        ? workItemsApi.list({ type: "support", view: "open", perPage: 10, sort: "-updated" })
        : workItemsApi.list({ assignee: "me", view: "open", perPage: 10, sort: "due_at" }),
    [isClient],
  );

  const keys = isClient
    ? (["waitingMe", "waitingClient", "overdue"] as const)
    : (["waitingMe", "assigned", "toReview", "waitingClient", "overdue"] as const);
  const myItems = (mine.data?.items ?? []).filter((i) => i.type.code !== "implementation");

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("home.title")}</h1>
        <p className="muted">
          {t("home.greeting", { name: user?.name.split(" ")[0] ?? "" })} {t("home.subtitle")}
        </p>
      </header>

      {summary.error && <ErrorNote error={summary.error} onRetry={summary.reload} />}
      <div className="counters">
        {keys.map((key) => (
          <div key={key} className={`card counter ${key}`}>
            <span className="counter-value">{summary.data ? summary.data[key] : "…"}</span>
            <span className="counter-label">{t(isClient ? `home.clientCounters.${key}` : `home.counters.${key}`)}</span>
          </div>
        ))}
      </div>

      {myItems.length > 0 && (
        <>
          <h2 className="section-title">{isClient ? t("home.myTickets") : t("home.assignedToMe")}</h2>
          <section className="card table-card">
            <table className="table">
              <tbody>
                {myItems.map((item) => (
                  <tr key={item.id}>
                    <td className="number">{item.number}</td>
                    <td>
                      <Link to={detailPath(item)} className="row-link">
                        {item.title}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.dueAt && <DueLabel date={item.dueAt} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <h2 className="section-title">{t("home.myImplementations")}</h2>
      {impls.data && impls.data.items.length === 0 && <p className="muted">{t("work.empty")}</p>}
      <div className="card-grid">
        {impls.data?.items.map((impl) => <ImplementationCard key={impl.id} impl={impl} />)}
      </div>
    </div>
  );
}
