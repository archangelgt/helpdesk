import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import type { ClientRequestStatus, PriorityDto, StatusCategory, StatusDto } from "../types/api";
import { Pill, type PillTone } from "./Progress";

const CATEGORY_TONE: Record<StatusCategory, PillTone> = {
  new: "muted",
  open: "info",
  in_progress: "warn",
  waiting_client: "client",
  waiting_internal: "muted",
  resolved: "ok",
  closed: "ok",
  cancelled: "muted",
};

const REQUEST_TONE: Record<ClientRequestStatus, PillTone> = {
  pending: "client",
  submitted: "info",
  in_review: "info",
  accepted: "ok",
  rejected: "danger",
  cancelled: "muted",
};

/** Nombre del estado en el idioma del usuario; los clientes ven la etiqueta pensada para ellos si existe. */
export function useStatusLabel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isClient = user?.role?.scope === "client";
  return (status: StatusDto) =>
    isClient && status.clientLabel
      ? t(`${status.labelKey}_client`, { defaultValue: status.clientLabel })
      : t(status.labelKey, { defaultValue: status.name });
}

export function StatusBadge({ status }: { status: StatusDto }) {
  const label = useStatusLabel();
  return <Pill tone={CATEGORY_TONE[status.category]}>{label(status)}</Pill>;
}

export function RequestPill({ status }: { status: ClientRequestStatus }) {
  const { t } = useTranslation();
  return <Pill tone={REQUEST_TONE[status]}>{t(`request.${status}`)}</Pill>;
}

export function PriorityLabel({ priority }: { priority: PriorityDto | null }) {
  const { t } = useTranslation();
  if (!priority) return null;
  return (
    <span className="priority" style={{ color: priority.color }}>
      {t(priority.labelKey, { defaultValue: priority.name })}
    </span>
  );
}
