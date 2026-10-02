import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import type { ActivityDto } from "../types/api";
import { useAuth } from "../auth/AuthProvider";
import { useAction } from "../hooks/useApi";
import { formatDateTime } from "../utils/dates";
import { useStatusLabel } from "./StatusBadge";

function EventText({ entry }: { entry: Extract<ActivityDto, { kind: "event" }> }) {
  const { t } = useTranslation();
  const data = entry.data as Record<string, string | undefined>;
  return <>{t(`activity.${entry.event}`, { defaultValue: entry.event, stage: data.stage, request: data.request, reason: data.reason })}</>;
}

/** Bitácora: comentarios, cambios de estado y eventos, del más reciente al más antiguo. */
export function ActivityFeed({ items }: { items: ActivityDto[] }) {
  const { t, i18n } = useTranslation();
  const label = useStatusLabel();
  const lang = i18n.resolvedLanguage ?? "es";

  if (!items.length) return <p className="muted small">{t("activity.empty")}</p>;

  return (
    <ul className="activity">
      {items.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className={`activity-${entry.kind}${entry.kind === "comment" && entry.visibility === "internal" ? " internal" : ""}`}>
          <div className="activity-head">
            <strong>{entry.actor?.name ?? t("activity.system")}</strong>
            {entry.kind === "comment" && entry.visibility === "internal" && (
              <span className="internal-tag">
                <Lock size={12} aria-hidden="true" /> {t("activity.internal")}
              </span>
            )}
            <time>{formatDateTime(entry.at, lang)}</time>
          </div>
          {entry.kind === "comment" && <p className="activity-body">{entry.body}</p>}
          {entry.kind === "status" && (
            <p className="activity-body muted">
              {entry.from
                ? t("activity.statusChanged", { from: label(entry.from), to: label(entry.to) })
                : t("activity.statusSet", { to: label(entry.to) })}
            </p>
          )}
          {entry.kind === "event" && (
            <p className="activity-body muted">
              <EventText entry={entry} />
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Caja para comentar; el personal elige si el comentario es público o interno. */
export function CommentBox({ onSend }: { onSend: (body: string, visibility: "public" | "internal") => Promise<unknown> }) {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const canInternal = user?.role?.scope === "staff" && can("comment.create_internal");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const { busy, error, run } = useAction();

  return (
    <form
      className="comment-box"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        const sent = await run(() => onSend(body.trim(), visibility));
        if (sent !== undefined) setBody("");
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={visibility === "internal" ? t("activity.internalPlaceholder") : t("activity.placeholder")}
        aria-label={t("activity.placeholder")}
        className={visibility === "internal" ? "internal" : undefined}
      />
      <div className="comment-actions">
        {canInternal && (
          <div className="segmented" role="group">
            {(["public", "internal"] as const).map((v) => (
              <button key={v} type="button" className={visibility === v ? "on" : ""} onClick={() => setVisibility(v)}>
                {t(`activity.${v}`)}
              </button>
            ))}
          </div>
        )}
        <button type="submit" className="btn btn-primary-sm" disabled={busy || !body.trim()}>
          {t("activity.send")}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
