import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { attachmentsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { useAction } from "../hooks/useApi";
import type { AttachmentDto } from "../types/api";
import { formatDateTime } from "../utils/dates";

const MAX_BYTES = 25 * 1024 * 1024;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function openAttachment(file: AttachmentDto) {
  const blob = await attachmentsApi.download(file.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface Props {
  workItemId: string;
  files: AttachmentDto[];
  /** Archivos de una etapa o de un requerimiento; sin ninguno se muestran todos los del caso. */
  stageId?: string;
  clientRequestId?: string;
  canUpload: boolean;
  hideEmpty?: boolean;
  onChange: () => void;
}

/** Archivos del caso: subir, descargar (con la sesión) y borrar los propios. */
export function Attachments({ workItemId, files, stageId, clientRequestId, canUpload, hideEmpty = false, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const lang = i18n.resolvedLanguage ?? "es";
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useAction();
  const [localError, setLocalError] = useState<string | null>(null);
  const staffEditor = user?.role?.scope === "staff" && can("work_item.update");
  const shown = clientRequestId
    ? files.filter((f) => f.clientRequestId === clientRequestId)
    : stageId
      ? files.filter((f) => f.stageId === stageId)
      : files;

  const upload = async (list: FileList | null) => {
    setLocalError(null);
    const file = list?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setLocalError(t("files.tooLarge", { max: "25 MB" }));
      return;
    }
    const done = await run(() => attachmentsApi.upload(workItemId, file, clientRequestId ? { clientRequestId } : stageId ? { stageId } : {}));
    if (input.current) input.current.value = "";
    if (done) onChange();
  };

  return (
    <div className="attachments">
      {shown.length === 0 ? (
        !hideEmpty && <p className="muted small">{t("files.empty")}</p>
      ) : (
        <ul className="file-list">
          {shown.map((file) => (
            <li key={file.id}>
              <FileText size={16} aria-hidden="true" className="muted" />
              <button type="button" className="file-name" onClick={() => void run(() => openAttachment(file))} title={t("files.download")}>
                {file.name}
              </button>
              <span className="muted small">
                {formatSize(file.size)} · {file.uploadedBy?.name ?? "—"} · {formatDateTime(file.created, lang)}
              </span>
              <span className="file-actions">
                <button type="button" className="icon-link" onClick={() => void run(() => openAttachment(file))} aria-label={t("files.download")}>
                  <Download size={15} />
                </button>
                {(staffEditor || file.uploadedBy?.id === user?.id) && (
                  <button
                    type="button"
                    className="icon-link danger"
                    aria-label={t("files.remove")}
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm(t("files.confirmRemove", { name: file.name }))) return;
                      const ok = await run(async () => {
                        await attachmentsApi.remove(file.id);
                        return true;
                      });
                      if (ok) onChange();
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <label className={`btn btn-soft upload-btn${busy ? " busy" : ""}`}>
          <Paperclip size={15} aria-hidden="true" /> {busy ? t("files.uploading") : t("files.attach")}
          <input ref={input} type="file" hidden disabled={busy} onChange={(e) => void upload(e.target.files)} />
        </label>
      )}
      {(localError || error) && <p className="form-error">{localError || error}</p>}
      {canUpload && <p className="hint">{t("files.hint", { max: "25 MB" })}</p>}
    </div>
  );
}
