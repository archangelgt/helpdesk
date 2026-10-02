import { useTranslation } from "react-i18next";
import type { ClientRequestStatus, StageStatus } from "../types/implementation";
import { Pill, type PillTone } from "./Progress";

const STAGE_TONE: Record<StageStatus, PillTone> = {
  completed: "ok",
  in_progress: "warn",
  waiting_client: "client",
  pending: "muted",
};

const REQUEST_TONE: Record<ClientRequestStatus, PillTone> = {
  pending: "client",
  submitted: "info",
  in_review: "info",
  accepted: "ok",
  rejected: "danger",
};

export function StagePill({ status }: { status: StageStatus }) {
  const { t } = useTranslation();
  return <Pill tone={STAGE_TONE[status]}>{t(`status.${status}`)}</Pill>;
}

export function RequestPill({ status }: { status: ClientRequestStatus }) {
  const { t } = useTranslation();
  return <Pill tone={REQUEST_TONE[status]}>{t(`request.${status}`)}</Pill>;
}
