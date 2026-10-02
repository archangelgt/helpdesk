import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import type { Implementation } from "../../types/implementation";
import { ProgressBar, ProgressRing } from "../../components/Progress";
import { currentStage, implementationPercent, openClientRequests } from "../../utils/progress";
import { DueLabel } from "./DueLabel";

export function ImplementationCard({ impl }: { impl: Implementation }) {
  const { t } = useTranslation();
  const pct = implementationPercent(impl);
  const stage = currentStage(impl);
  const waiting = openClientRequests(impl).length;

  return (
    <Link to={`/implementaciones/${impl.id}`} className="card impl-card">
      <div className="impl-card-head">
        <ProgressRing value={pct} size={56} />
        <div className="impl-card-title">
          <span className="number">{impl.number}</span>
          <strong>{impl.title}</strong>
          <span className="muted">{impl.client}</span>
        </div>
      </div>
      <ProgressBar value={pct} />
      {stage && (
        <p className="muted small">{t("impl.currentStage", { order: stage.order, name: stage.name })}</p>
      )}
      <div className="impl-card-foot">
        <DueLabel date={impl.dueDate} />
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
