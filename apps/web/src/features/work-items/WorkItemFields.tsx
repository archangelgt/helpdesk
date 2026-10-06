import { useTranslation } from "react-i18next";
import { adminApi, workItemsApi, type UpdateWorkItemBody } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { useAction, useApi } from "../../hooks/useApi";
import type { WorkItemDetailDto } from "../../types/api";
import { formatDate, toDay } from "../../utils/dates";

/** Datos del caso; el personal con permiso los edita directamente. */
export function WorkItemFields({ item, onChange }: { item: WorkItemDetailDto; onChange: (item: WorkItemDetailDto) => void }) {
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const lang = i18n.resolvedLanguage ?? "es";
  const staff = user?.role?.scope === "staff";
  const canEdit = staff && can("work_item.update");
  const canAssign = canEdit && can("work_item.assign");
  const { busy, error, run } = useAction();

  const users = useApi(() => (canAssign ? adminApi.assignableUsers() : Promise.resolve([])), [canAssign]);
  const priorities = useApi(() => (canEdit ? adminApi.priorities() : Promise.resolve([])), [canEdit]);

  const save = async (patch: UpdateWorkItemBody) => {
    const updated = await run(() => workItemsApi.update(item.id, patch));
    if (updated) onChange(updated);
  };

  return (
    <dl className="fields">
      {item.client && (
        <>
          <dt>{t("work.fields.client")}</dt>
          <dd>{item.client.name}</dd>
        </>
      )}
      <dt>{t("work.fields.requester")}</dt>
      <dd>{item.requester?.name ?? "—"}</dd>

      <dt>{t("work.fields.assignee")}</dt>
      <dd>
        {canAssign ? (
          <select value={item.assignee?.id ?? ""} disabled={busy} onChange={(e) => void save({ assigneeId: e.target.value || null })}>
            <option value="">{t("work.unassigned")}</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        ) : (
          (item.assignee?.name ?? t("work.unassigned"))
        )}
      </dd>

      <dt>{t("work.fields.priority")}</dt>
      <dd>
        {canEdit ? (
          <select value={item.priority?.id ?? ""} disabled={busy} onChange={(e) => void save({ priorityId: e.target.value })}>
            {(priorities.data ?? (item.priority ? [item.priority] : [])).map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.labelKey, { defaultValue: p.name })}
              </option>
            ))}
          </select>
        ) : (
          item.priority && t(item.priority.labelKey, { defaultValue: item.priority.name })
        )}
      </dd>

      <dt>{t("work.fields.due")}</dt>
      <dd>
        {canEdit ? (
          <input
            type="date"
            value={item.dueAt ? toDay(item.dueAt) : ""}
            disabled={busy}
            onChange={(e) => void save({ dueAt: e.target.value || null })}
          />
        ) : item.dueAt ? (
          formatDate(item.dueAt, lang)
        ) : (
          "—"
        )}
      </dd>

      <dt>{t("work.fields.created")}</dt>
      <dd>
        {formatDate(item.created, lang)}
        {item.createdBy && <span className="muted"> · {item.createdBy.name}</span>}
      </dd>
      {error && <dd className="form-error full">{error}</dd>}
    </dl>
  );
}
