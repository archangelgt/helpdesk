import { useState } from "react";
import { useTranslation } from "react-i18next";
import { adminApi, stagesApi, workItemsApi } from "../../api/endpoints";
import { useAction, useApi } from "../../hooks/useApi";
import type { ClientRequestType, ResponsibleSide, StageDto, WorkItemDetailDto } from "../../types/api";
import { toDay } from "../../utils/dates";

const SIDES: ResponsibleSide[] = ["internal", "client", "shared"];
const REQUEST_TYPES: ClientRequestType[] = ["information", "document", "data_upload", "access", "approval", "meeting"];

interface FormProps {
  onDone: (item: WorkItemDetailDto) => void;
  onCancel: () => void;
}

function FormButtons({ busy, disabled, submitLabel, onCancel }: { busy: boolean; disabled?: boolean; submitLabel: string; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="btn-row">
      <button type="submit" className="btn btn-primary-sm" disabled={busy || disabled}>
        {submitLabel}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
        {t("common.cancel")}
      </button>
    </div>
  );
}

/** Etapa nueva al final del plan (implementaciones sin plantilla o etapas extra). */
export function AddStageForm({ item, onDone, onCancel }: FormProps & { item: WorkItemDetailDto }) {
  const { t } = useTranslation();
  const users = useApi(() => adminApi.assignableUsers(), []);
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({
    name: "",
    description: "",
    side: "internal" as ResponsibleSide,
    ownerId: "",
    plannedStart: "",
    plannedEnd: "",
    dependsOnPrevious: item.stages.length > 0,
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="card form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const updated = await run(() =>
          workItemsApi.addStage(item.id, {
            name: form.name.trim(),
            ...(form.description.trim() && { description: form.description.trim() }),
            side: form.side,
            ownerId: form.ownerId || null,
            plannedStart: form.plannedStart || null,
            plannedEnd: form.plannedEnd || null,
            dependsOnPrevious: form.dependsOnPrevious,
          }),
        );
        if (updated) onDone(updated);
      }}
    >
      <h2 className="card-title">{t("stageForm.addTitle", { order: item.stages.length + 1 })}</h2>
      <div className="form-grid">
        <label className="field">
          {t("stageForm.name")}
          <input value={form.name} onChange={set("name")} required maxLength={120} autoFocus />
        </label>
        <label className="field">
          {t("stageForm.side")}
          <select value={form.side} onChange={set("side")}>
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {t(`side.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("stageForm.owner")}
          <select value={form.ownerId} onChange={set("ownerId")}>
            <option value="">{t("work.unassigned")}</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("stageForm.plannedStart")}
          <input type="date" value={form.plannedStart} onChange={set("plannedStart")} />
        </label>
        <label className="field">
          {t("stageForm.plannedEnd")}
          <input type="date" value={form.plannedEnd} min={form.plannedStart || undefined} onChange={set("plannedEnd")} />
        </label>
      </div>
      <label className="field">
        {t("stageForm.description")}
        <textarea value={form.description} onChange={set("description")} rows={3} maxLength={2_000} placeholder={t("stageForm.descriptionHint")} />
      </label>
      {item.stages.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={form.dependsOnPrevious} onChange={(e) => setForm({ ...form, dependsOnPrevious: e.target.checked })} />
          {t("stageForm.dependsOnPrevious", { name: item.stages[item.stages.length - 1].name })}
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <FormButtons busy={busy} disabled={!form.name.trim()} submitLabel={t("stageForm.add")} onCancel={onCancel} />
    </form>
  );
}

/** Corregir nombre, descripción, responsable y fechas de una etapa. */
export function EditStageForm({ stage, onDone, onCancel }: FormProps & { stage: StageDto }) {
  const { t } = useTranslation();
  const users = useApi(() => adminApi.assignableUsers(), []);
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({
    name: stage.name,
    description: stage.description,
    ownerId: stage.owner?.id ?? "",
    plannedStart: stage.plannedStart ? toDay(stage.plannedStart) : "",
    plannedEnd: stage.plannedEnd ? toDay(stage.plannedEnd) : "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="form-card edit-stage"
      onSubmit={async (e) => {
        e.preventDefault();
        const updated = await run(() =>
          stagesApi.update(stage.id, {
            name: form.name.trim(),
            description: form.description.trim(),
            ownerId: form.ownerId || null,
            plannedStart: form.plannedStart || null,
            plannedEnd: form.plannedEnd || null,
          }),
        );
        if (updated) onDone(updated);
      }}
    >
      <div className="form-grid">
        <label className="field">
          {t("stageForm.name")}
          <input value={form.name} onChange={set("name")} required maxLength={120} autoFocus />
        </label>
        <label className="field">
          {t("stageForm.owner")}
          <select value={form.ownerId} onChange={set("ownerId")}>
            <option value="">{t("work.unassigned")}</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("stageForm.plannedStart")}
          <input type="date" value={form.plannedStart} onChange={set("plannedStart")} />
        </label>
        <label className="field">
          {t("stageForm.plannedEnd")}
          <input type="date" value={form.plannedEnd} min={form.plannedStart || undefined} onChange={set("plannedEnd")} />
        </label>
      </div>
      <label className="field">
        {t("stageForm.description")}
        <textarea value={form.description} onChange={set("description")} rows={3} maxLength={2_000} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <FormButtons busy={busy} disabled={!form.name.trim()} submitLabel={t("common.save")} onCancel={onCancel} />
    </form>
  );
}

/** Pedirle algo al cliente (información, documentos, accesos…), opcionalmente bloqueando una etapa. */
export function NewClientRequestForm({ item, defaultStageId, onDone, onCancel }: FormProps & { item: WorkItemDetailDto; defaultStageId?: string }) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "information" as ClientRequestType,
    stageId: defaultStageId ?? "",
    dueAt: "",
    blocking: false,
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="card form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const updated = await run(() =>
          workItemsApi.addClientRequest(item.id, {
            title: form.title.trim(),
            ...(form.description.trim() && { description: form.description.trim() }),
            type: form.type,
            stageId: form.stageId || null,
            dueAt: form.dueAt || null,
            blocking: Boolean(form.stageId) && form.blocking,
          }),
        );
        if (updated) onDone(updated);
      }}
    >
      <h2 className="card-title">{t("requestForm.title")}</h2>
      <div className="form-grid">
        <label className="field">
          {t("requestForm.what")}
          <input value={form.title} onChange={set("title")} required maxLength={200} autoFocus placeholder={t("requestForm.whatHint")} />
        </label>
        <label className="field">
          {t("requestForm.type")}
          <select value={form.type} onChange={set("type")}>
            {REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`requestType.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("requestForm.stage")}
          <select value={form.stageId} onChange={set("stageId")}>
            <option value="">{t("requestForm.noStage")}</option>
            {item.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.order}. {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("requestForm.dueAt")}
          <input type="date" value={form.dueAt} onChange={set("dueAt")} />
        </label>
      </div>
      <label className="field">
        {t("requestForm.details")}
        <textarea value={form.description} onChange={set("description")} rows={3} maxLength={5_000} placeholder={t("requestForm.detailsHint")} />
      </label>
      {form.stageId && (
        <label className="check">
          <input type="checkbox" checked={form.blocking} onChange={(e) => setForm({ ...form, blocking: e.target.checked })} />
          {t("requestForm.blocking")}
        </label>
      )}
      <p className="hint">{t("requestForm.notice")}</p>
      {error && <p className="form-error">{error}</p>}
      <FormButtons busy={busy} disabled={!form.title.trim()} submitLabel={t("requestForm.submit")} onCancel={onCancel} />
    </form>
  );
}
