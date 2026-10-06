import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import type { WorkItemSummaryDto } from "../../types/api";
import { DueLabel } from "../../components/DueLabel";
import { ProgressBar, ProgressRing } from "../../components/Progress";
import { StatusBadge } from "../../components/StatusBadge";

export function ImplementationCard({ impl }: { impl: WorkItemSummaryDto }) {
  const { t } = useTranslation();
  const summary = impl.implementation;
  const stage = summary?.currentStage;
  const waiting = summary?.openRequests ?? 0;
  const done = impl.status.isFinal;

  return (
    <Link to={`/implementaciones/${impl.id}`} className="card impl-card">
      <div className="impl-card-head">
        <ProgressRing value={impl.progressPercent} size={56} />
        <div className="impl-card-title">
          <span className="number">{impl.number}</span>
          <strong>{impl.title}</strong>
          <span className="muted">{impl.client?.name ?? "—"}</span>
        </div>
        <span className="impl-card-status">
          <StatusBadge status={impl.status} />
        </span>
      </div>
      <ProgressBar value={impl.progressPercent} />
      {stage && !done && <p className="muted small">{t("impl.currentStage", { order: stage.order, name: stage.name })}</p>}
      {summary && (
        <p className="muted small">{t("impl.stagesDone", { done: summary.completedStages, total: summary.stageCount })}</p>
      )}
      <div className="impl-card-foot">
        <DueLabel date={impl.dueAt} done={done} />
        {waiting > 0 && (
          <span className="waiting-chip">
            <AlertCircle size={14} aria-hidden="true" />
            {t("impl.waitingTitle", { count: waiting })}
          </span>
        )}
      </div>
    </Link>
  );
}
