import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TransitionDto } from "../types/api";
import { useAction } from "../hooks/useApi";
import { useStatusLabel } from "./StatusBadge";

/** Botones con los siguientes estados posibles; pide comentario cuando la transición lo exige. */
export function TransitionBar({
  transitions,
  onApply,
  compact = false,
}: {
  transitions: TransitionDto[];
  onApply: (statusId: string, comment?: string) => Promise<unknown>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const label = useStatusLabel();
  const { busy, error, run } = useAction();
  const [asking, setAsking] = useState<TransitionDto | null>(null);
  const [comment, setComment] = useState("");

  if (!transitions.length) return null;

  const apply = async (tr: TransitionDto, text?: string) => {
    const done = await run(() => onApply(tr.to.id, text));
    if (done !== undefined) {
      setAsking(null);
      setComment("");
    }
  };

  return (
    <div className={`transition-bar${compact ? " compact" : ""}`}>
      {!asking && (
        <div className="btn-row">
          {transitions.map((tr) => (
            <button
              key={tr.to.id}
              type="button"
              className={`btn ${tr.to.isFinal || tr.to.category === "resolved" ? "btn-ok" : "btn-soft"}`}
              disabled={busy}
              onClick={() => (tr.requiresComment ? setAsking(tr) : void apply(tr))}
            >
              {label(tr.to)}
            </button>
          ))}
        </div>
      )}
      {asking && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) void apply(asking, comment.trim());
          }}
        >
          <label className="field">
            {t("work.commentFor", { status: label(asking.to) })}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} autoFocus required />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary-sm" disabled={busy || !comment.trim()}>
              {t("common.confirm")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(null)}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
