import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { workItemsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { useAction } from "../hooks/useApi";
import type { WorkItemDetailDto } from "../types/api";

/** Descripción del caso; el personal con permiso la edita en el mismo lugar. */
export function DescriptionCard({ item, onChange }: { item: WorkItemDetailDto; onChange: (item: WorkItemDetailDto) => void }) {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const canEdit = user?.role?.scope === "staff" && can("work_item.update");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.description);
  const { busy, error, run } = useAction();

  const start = () => {
    setText(item.description);
    setEditing(true);
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{t("work.fields.description")}</h2>
        {canEdit && !editing && (
          <button type="button" className="btn btn-ghost" onClick={start}>
            <Pencil size={14} aria-hidden="true" /> {item.description ? t("common.edit") : t("work.addDescription")}
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="inline-form field"
          onSubmit={async (e) => {
            e.preventDefault();
            const updated = await run(() => workItemsApi.update(item.id, { description: text.trim() }));
            if (updated) {
              onChange(updated);
              setEditing(false);
            }
          }}
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={20_000} autoFocus placeholder={t("work.descriptionPlaceholder")} />
          {error && <p className="form-error">{error}</p>}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary-sm" disabled={busy}>
              {t("common.save")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : item.description ? (
        <p className="prewrap">{item.description}</p>
      ) : (
        <p className="muted small">{canEdit ? t("work.noDescriptionEdit") : t("work.noDescription")}</p>
      )}
    </section>
  );
}
