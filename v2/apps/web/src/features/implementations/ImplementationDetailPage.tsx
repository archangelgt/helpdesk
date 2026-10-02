import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { Stage } from "../../types/implementation";
import { ProgressBar, ProgressRing, StatusDot } from "../../components/Progress";
import { RequestPill, StagePill } from "../../components/StatusPills";
import {
  currentStage,
  formatDate,
  implementationPercent,
  openClientRequests,
  stagePercent,
} from "../../utils/progress";
import { DueLabel } from "./DueLabel";
import { findImplementation } from "./sampleData";

function useEstimate() {
  const { t } = useTranslation();
  return (stage: Stage) =>
    stage.estimateDays === null ? t("impl.ongoing") : t("impl.days", { count: stage.estimateDays });
}

export function ImplementationDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const estimate = useEstimate();
  const impl = findImplementation(id);

  if (!impl) {
    return (
      <div className="card">
        <p>{t("impl.notFound")}</p>
        <Link to="/implementaciones">{t("impl.back")}</Link>
      </div>
    );
  }

  const pct = implementationPercent(impl);
  const current = currentStage(impl);
  const waiting = openClientRequests(impl);
  const lang = i18n.resolvedLanguage ?? "es";

  return (
    <div className="stack">
      <Link to="/implementaciones" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> {t("impl.back")}
      </Link>

      <section className="card hero">
        <ProgressRing value={pct} />
        <div>
          <span className="number">{impl.number}</span>
          <h1>{impl.title}</h1>
          <p className="muted">
            {t("impl.client")}: {impl.client} · {t("impl.due", { date: formatDate(impl.dueDate, lang) })} ·{" "}
            <DueLabel date={impl.dueDate} />
          </p>
        </div>
      </section>

      {waiting.length > 0 && (
        <section className="card waiting-box">
          <h2 className="waiting-title">
            <AlertCircle size={18} aria-hidden="true" /> {t("impl.waitingTitle", { count: waiting.length })}
          </h2>
          <p className="muted small">{t("impl.waitingLead")}</p>
          <ul className="requests">
            {waiting.map((r) => (
              <li key={r.id}>
                <span>{r.title}</span>
                <span className="request-meta">
                  {r.blocking && <span className="muted small">{t("request.blocking")}</span>}
                  <span className="muted small">{t("request.due", { date: formatDate(r.dueDate, lang) })}</span>
                  <RequestPill status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current && (
        <>
          <h2 className="section-title">{t("impl.currentStage", { order: current.order, name: current.name })}</h2>
          <section className="card stage-current">
            <div className="stage-head">
              <span className="stage-num">{current.order}</span>
              <strong>{current.name}</strong>
              <span className="stage-meta">
                {t("impl.tasksCount", {
                  done: current.checklist.filter((c) => c.status === "done").length,
                  total: current.checklist.length,
                })}{" "}
                · {estimate(current)}
              </span>
            </div>
            <ProgressBar value={stagePercent(current)} />
            <ul className="tasks">
              {current.checklist.map((item) => (
                <li key={item.title} className={item.status}>
                  <StatusDot status={item.status} />
                  <span className="task-title">{item.title}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <h2 className="section-title">{t("impl.stages")}</h2>
      <div className="stage-grid">
        {impl.stages.map((stage) => (
          <section key={stage.id} className={`card stage-card${stage === current ? " active" : ""}`}>
            <div className="stage-head">
              <span className="stage-num">{stage.order}</span>
              <strong>{stage.name}</strong>
              <span className="stage-meta">
                <StagePill status={stage.status} />
              </span>
            </div>
            <ProgressBar value={stagePercent(stage)} />
            <p className="muted small">
              {stage.summary ?? stage.checklist.slice(0, 3).map((c) => c.title).join(" · ")}
            </p>
            <p className="stage-foot">
              <span>{estimate(stage)}</span>
              <span className={`side ${stage.side}`}>{t("impl.dependsOn", { side: t(`side.${stage.side}`) })}</span>
            </p>
          </section>
        ))}
      </div>

      {impl.requests.length > 0 && (
        <>
          <h2 className="section-title">{t("impl.clientRequests")}</h2>
          <section className="card">
            <ul className="requests">
              {impl.requests.map((r) => (
                <li key={r.id}>
                  <span>{r.title}</span>
                  <span className="request-meta">
                    <span className="muted small">{t("request.due", { date: formatDate(r.dueDate, lang) })}</span>
                    <RequestPill status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <h2 className="section-title">{t("impl.log")}</h2>
      <section className="card log">
        {impl.log.map((entry, i) => (
          <div key={i}>
            <time>{formatDate(entry.date, lang)}</time>
            <span>{entry.text}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
