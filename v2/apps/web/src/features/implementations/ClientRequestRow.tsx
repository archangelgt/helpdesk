import { useState } from "react";
import { useTranslation } from "react-i18next";
import { clientRequestsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { Attachments } from "../../components/Attachments";
import { RequestPill } from "../../components/StatusBadge";
import { useAction } from "../../hooks/useApi";
import type { AttachmentDto, ClientRequestDto, WorkItemDetailDto } from "../../types/api";
import { formatDate } from "../../utils/dates";

type Mode = "idle" | "submit" | "reject";

/** Un requerimiento al cliente con lo que cada lado puede hacer: el cliente entrega, nuestro equipo acepta o rechaza. */
export function ClientRequestRow({
  request,
  stageName,
  files,
  workItemId,
  onChange,
  onReload,
  readOnly = false,
}: {
  request: ClientRequestDto;
  stageName?: string;
  files: AttachmentDto[];
  workItemId: string;
  onChange: (item: WorkItemDetailDto) => void;
  onReload: () => void;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const lang = i18n.resolvedLanguage ?? "es";
  const isClient = user?.role?.scope === "client";
  const { busy, error, run } = useAction();
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("");

  const open = request.status === "pending" || request.status === "rejected";
  const inReview = request.status === "submitted" || request.status === "in_review";
  const canSubmit = !readOnly && isClient && can("client_request.submit") && open;
  const canReview = !readOnly && !isClient && can("client_request.review") && (open || inReview);
  const requestFiles = files.filter((f) => f.clientRequestId === request.id);

  const act = async (action: () => Promise<WorkItemDetailDto>) => {
    const updated = await run(action);
    if (updated) {
      setMode("idle");
      setText("");
      onChange(updated);
    }
  };

  return (
    <li className="request-row">
      <div className="request-main">
        <span className="request-title">{request.title}</span>
        <span className="request-meta">
          {stageName && <span className="muted small">{stageName}</span>}
          {request.blocking && <span className="muted small">{t("request.blocking")}</span>}
          {request.dueAt && <span className="muted small">{t("request.due", { date: formatDate(request.dueAt, lang) })}</span>}
          <RequestPill status={request.status} />
        </span>
      </div>
      {request.description && <p className="muted small request-desc">{request.description}</p>}
      {request.status === "rejected" && request.rejectionReason && (
        <p className="small request-reason">{t("request.rejectedBecause", { reason: request.rejectionReason })}</p>
      )}

      {(requestFiles.length > 0 || mode === "submit") && (
        <Attachments
          workItemId={workItemId}
          files={files}
          clientRequestId={request.id}
          canUpload={mode === "submit"}
          hideEmpty={mode !== "submit"}
          onChange={onReload}
        />
      )}

      {mode === "idle" && (canSubmit || canReview) && (
        <div className="btn-row">
          {canSubmit && (
            <button type="button" className="btn btn-primary-sm" disabled={busy} onClick={() => setMode("submit")}>
              {t("request.submit")}
            </button>
          )}
          {canReview && (
            <>
              <button type="button" className="btn btn-ok" disabled={busy} onClick={() => void act(() => clientRequestsApi.review(request.id, "accept"))}>
                {t("request.accept")}
              </button>
              {inReview && (
                <button type="button" className="btn btn-soft" disabled={busy} onClick={() => setMode("reject")}>
                  {t("request.reject")}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {mode !== "idle" && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "submit") void act(() => clientRequestsApi.submit(request.id, text.trim() || undefined));
            else if (text.trim()) void act(() => clientRequestsApi.review(request.id, "reject", text.trim()));
          }}
        >
          <label className="field">
            {mode === "submit" ? t("request.submitNote") : t("request.rejectReason")}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus required={mode === "reject"} />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary-sm" disabled={busy || (mode === "reject" && !text.trim())}>
              {mode === "submit" ? t("request.submit") : t("request.reject")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
    </li>
  );
}
