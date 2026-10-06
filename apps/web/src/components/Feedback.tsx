import { useTranslation } from "react-i18next";
import type { ApiError } from "../api/client";

export function Loading() {
  const { t } = useTranslation();
  return <p className="muted loading">{t("common.loading")}</p>;
}

export function ErrorNote({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="card error-note">
      <span>{error.status === 404 ? t("common.notFound") : error.message}</span>
      {onRetry && error.status !== 404 && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
