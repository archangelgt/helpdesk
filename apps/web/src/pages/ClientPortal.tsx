import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Inbox, LifeBuoy } from "lucide-react";
import { clientRequestsApi, workItemsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { DueLabel } from "../components/DueLabel";
import { ErrorNote, Loading } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { ClientRequestRow } from "../features/implementations/ClientRequestRow";
import { ImplementationCard } from "../features/implementations/ImplementationCard";
import { useAction, useApi } from "../hooks/useApi";
import type { ClientRequestListItemDto } from "../types/api";
import { formatDate } from "../utils/dates";
import { detailPath, pathFor } from "../utils/paths";

function NewTicketCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  if (!open) {
    return (
      <section className="card portal-help">
        <LifeBuoy size={22} aria-hidden="true" />
        <div>
          <strong>{t("portal.helpTitle")}</strong>
          <p className="muted small">{t("portal.helpLead")}</p>
        </div>
        <button type="button" className="btn btn-primary-sm" onClick={() => setOpen(true)}>
          {t("portal.report")}
        </button>
      </section>
    );
  }

  return (
    <form
      className="card form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const item = await run(() => workItemsApi.create({ type: "support", title: title.trim(), description: description.trim() || undefined }));
        if (item) navigate(detailPath(item));
      }}
    >
      <h2 className="card-title">{t("portal.report")}</h2>
      <label className="field">
        {t("portal.whatHappens")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("portal.whatHappensHint")} maxLength={200} required autoFocus />
      </label>
      <label className="field">
        {t("portal.details")}
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("portal.detailsHint")} maxLength={20000} />
        <span className="hint">{t("portal.filesHint")}</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary-sm" disabled={busy || !title.trim()}>
          {t("portal.send")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

/** Pendientes de un caso: carga el detalle para mostrar y subir los archivos de cada entrega. */
function PendingGroup({ requests, onDone }: { requests: ClientRequestListItemDto[]; onDone: () => void }) {
  const { workItem } = requests[0];
  const detail = useApi(() => workItemsApi.get(workItem.id), [workItem.id]);

  return (
    <li className="portal-group">
      <Link to={pathFor(workItem.typeCode, workItem.id)} className="portal-group-title">
        <span className="number">{workItem.number}</span> {workItem.title}
      </Link>
      <ul className="requests">
        {requests.map((r) => (
          <ClientRequestRow
            key={r.id}
            request={r}
            stageName={r.stageName ?? undefined}
            files={detail.data?.attachments ?? []}
            workItemId={workItem.id}
            onReload={detail.reload}
            onChange={() => {
              detail.reload();
              onDone();
            }}
          />
        ))}
      </ul>
    </li>
  );
}

function groupByWorkItem(items: ClientRequestListItemDto[]): ClientRequestListItemDto[][] {
  const groups = new Map<string, ClientRequestListItemDto[]>();
  for (const item of items) groups.set(item.workItem.id, [...(groups.get(item.workItem.id) ?? []), item]);
  return [...groups.values()];
}

/** Inicio del cliente: lo que necesitamos de él, sus casos y el avance de sus implementaciones. */
export function ClientPortal() {
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const pending = useApi(() => clientRequestsApi.list("open"), []);
  const inReview = useApi(() => clientRequestsApi.list("review"), []);
  const impls = useApi(() => workItemsApi.list({ type: "implementation", view: "open", perPage: 12, sort: "due_at" }), []);
  const tickets = useApi(() => workItemsApi.list({ type: "support", view: "open", perPage: 15, sort: "-updated" }), []);
  const reloadRequests = () => {
    pending.reload();
    inReview.reload();
  };
  const waitingTickets = (tickets.data?.items ?? []).filter((i) => i.status.category === "waiting_client");

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("portal.title", { name: user?.name.split(" ")[0] ?? "" })}</h1>
        <p className="muted">{t("portal.subtitle")}</p>
      </header>

      {can("work_item.create") && <NewTicketCard />}

      {pending.error && <ErrorNote error={pending.error} onRetry={pending.reload} />}
      {pending.loading && !pending.data && <Loading />}
      {pending.data && (pending.data.length > 0 || waitingTickets.length > 0) ? (
        <section className="card waiting-box">
          <h2 className="waiting-title">
            <AlertCircle size={18} aria-hidden="true" /> {t("portal.pendingTitle", { count: pending.data.length + waitingTickets.length })}
          </h2>
          <p className="muted small">{t("portal.pendingLead")}</p>
          <ul className="portal-groups">
            {groupByWorkItem(pending.data).map((group) => (
              <PendingGroup key={group[0].workItem.id} requests={group} onDone={reloadRequests} />
            ))}
            {waitingTickets.map((ticket) => (
              <li key={ticket.id} className="portal-group">
                <Link to={detailPath(ticket)} className="portal-group-title">
                  <span className="number">{ticket.number}</span> {ticket.title}
                </Link>
                <p className="small muted">{t("portal.ticketWaiting")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        pending.data && (
          <section className="card portal-clear">
            <CheckCircle2 size={20} aria-hidden="true" /> {t("portal.nothingPending")}
          </section>
        )
      )}

      {inReview.data && inReview.data.length > 0 && (
        <section className="card review-box">
          <h2 className="review-title">
            <Inbox size={18} aria-hidden="true" /> {t("impl.deliveredTitle", { count: inReview.data.length })}
          </h2>
          <ul className="requests">
            {inReview.data.map((r) => (
              <li key={r.id}>
                <span>
                  {r.title}{" "}
                  <Link to={pathFor(r.workItem.typeCode, r.workItem.id)} className="muted small">
                    {r.workItem.number}
                  </Link>
                </span>
                {r.submittedAt && <span className="muted small">{t("portal.deliveredOn", { date: formatDate(r.submittedAt, i18n.language) })}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {impls.data && impls.data.items.length > 0 && (
        <>
          <h2 className="section-title">{t("portal.implementations")}</h2>
          <div className="card-grid">
            {impls.data.items.map((impl) => (
              <ImplementationCard key={impl.id} impl={impl} />
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h2 className="section-title">{t("portal.tickets")}</h2>
        <Link to="/tickets" className="small">
          {t("portal.allTickets")}
        </Link>
      </div>
      {tickets.data && tickets.data.items.length === 0 && <p className="muted">{t("portal.noTickets")}</p>}
      {tickets.data && tickets.data.items.length > 0 && (
        <section className="card table-card">
          <table className="table">
            <tbody>
              {tickets.data.items.map((item) => (
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
                  <td className="muted small nowrap">{t("portal.updated", { date: formatDate(item.updated, i18n.language) })}</td>
                  <td>{item.dueAt && <DueLabel date={item.dueAt} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
