import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";
import { clientRequestsApi, workItemsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { DueLabel } from "../components/DueLabel";
import { ErrorNote } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { ImplementationCard } from "../features/implementations/ImplementationCard";
import { useApi } from "../hooks/useApi";
import { formatDate } from "../utils/dates";
import { detailPath, pathFor } from "../utils/paths";
import { ClientPortal } from "./ClientPortal";

export function HomePage() {
  const { user } = useAuth();
  return user?.role?.scope === "client" ? <ClientPortal /> : <StaffHome />;
}

function StaffHome() {
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const canReview = can("client_request.review");
  const summary = useApi(() => workItemsApi.summary(), []);
  const impls = useApi(() => workItemsApi.list({ type: "implementation", view: "open", perPage: 12, sort: "due_at" }), []);
  const mine = useApi(() => workItemsApi.list({ assignee: "me", view: "open", perPage: 10, sort: "due_at" }), []);
  const toReview = useApi(() => (canReview ? clientRequestsApi.list("review") : Promise.resolve([])), [canReview]);

  const keys = ["waitingMe", "assigned", "toReview", "waitingClient", "overdue"] as const;
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
            <span className="counter-label">{t(`home.counters.${key}`)}</span>
          </div>
        ))}
      </div>

      {toReview.data && toReview.data.length > 0 && (
        <section className="card review-box">
          <h2 className="review-title">
            <Inbox size={18} aria-hidden="true" /> {t("impl.reviewTitle", { count: toReview.data.length })}
          </h2>
          <ul className="requests">
            {toReview.data.map((r) => (
              <li key={r.id}>
                <Link to={pathFor(r.workItem.typeCode, r.workItem.id)} className="row-link">
                  {r.title}
                </Link>
                <span className="muted small">
                  {r.workItem.number} · {r.workItem.title}
                  {r.submittedAt && ` · ${t("portal.deliveredOn", { date: formatDate(r.submittedAt, i18n.language) })}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {myItems.length > 0 && (
        <>
          <h2 className="section-title">{t("home.assignedToMe")}</h2>
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
