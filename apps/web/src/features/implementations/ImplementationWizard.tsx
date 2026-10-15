import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, LayoutTemplate, PenLine, Plus, Trash2 } from "lucide-react";
import { adminApi, plansApi, workItemsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { useAction, useApi } from "../../hooks/useApi";
import type {
  ClientRequestType,
  PlanPreviewDto,
  PlanPreviewStageDto,
  PlanRequestInput,
  PlanStageInput,
  ResponsibleSide,
  UserOption,
} from "../../types/api";
import { formatDate, todayDay } from "../../utils/dates";

const STEPS = ["data", "plan", "stages", "review"] as const;
const SIDES: ResponsibleSide[] = ["internal", "client", "shared"];
const REQUEST_TYPES: ClientRequestType[] = ["information", "document", "data_upload", "approval", "meeting", "access", "payment"];

let keySeq = 0;
const newKey = () => `n${Date.now().toString(36)}${(keySeq++).toString(36)}`;

function blankStage(previous?: PlanStageInput): PlanStageInput {
  return {
    key: newKey(),
    name: "",
    description: "",
    side: "internal",
    durationDays: 5,
    dependsOn: previous ? [previous.key] : [],
    weight: 1,
    clientVisible: true,
    requiresEvidence: false,
    requiresClientApproval: false,
    ownerId: null,
    checklist: [],
    requests: [],
  };
}

function blankRequest(): PlanRequestInput {
  return { title: "", description: "", type: "information", dueInDays: 3, blocking: true };
}

function fromPreview(s: PlanPreviewStageDto): PlanStageInput {
  return {
    key: s.key,
    templateStageId: s.templateStageId ?? undefined,
    name: s.name,
    description: s.description,
    side: s.side,
    durationDays: s.durationDays,
    dependsOn: s.dependsOn,
    weight: s.weight,
    clientVisible: s.clientVisible,
    requiresEvidence: s.requiresEvidence,
    requiresClientApproval: s.requiresClientApproval,
    ownerId: s.ownerId,
    checklist: s.checklist,
    requests: s.requests.map((r) => ({
      templateRequestId: r.templateRequestId ?? undefined,
      title: r.title,
      description: r.description,
      type: r.type,
      dueInDays: r.dueInDays,
      blocking: r.blocking,
    })),
  };
}

/** Plan listo para la API: sin líneas vacías en las tareas ni requerimientos sin título. */
function toPayload(stages: PlanStageInput[]): PlanStageInput[] {
  return stages.map((s) => ({
    ...s,
    name: s.name.trim(),
    ownerId: s.ownerId || null,
    checklist: s.checklist.map((c) => c.trim()).filter(Boolean),
    requests: s.requests.filter((r) => r.title.trim()).map((r) => ({ ...r, title: r.title.trim() })),
  }));
}

const validDuration = (n: number) => Number.isInteger(n) && n >= 1 && n <= 365;

interface StageEditorProps {
  stage: PlanStageInput;
  index: number;
  stages: PlanStageInput[];
  users: UserOption[];
  dates?: PlanPreviewStageDto;
  onChange: (patch: Partial<PlanStageInput>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

function StageEditor({ stage, index, stages, users, dates, onChange, onMove, onRemove }: StageEditorProps) {
  const { t, i18n } = useTranslation();
  const others = stages.filter((s) => s.key !== stage.key);
  const order = (key: string) => stages.findIndex((s) => s.key === key) + 1;
  const tasks = stage.checklist.filter((c) => c.trim()).length;
  const setRequest = (i: number, patch: Partial<PlanRequestInput>) =>
    onChange({ requests: stage.requests.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <li className="wiz-stage">
      <div className="wiz-stage-head">
        <span className="stage-num">{index + 1}</span>
        <input
          className="wiz-stage-name"
          value={stage.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("wizard.stageName")}
          aria-label={t("wizard.stageName")}
          maxLength={120}
          required
        />
        <div className="wiz-stage-tools">
          <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label={t("wizard.moveUp")}>
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === stages.length - 1} aria-label={t("wizard.moveDown")}>
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={onRemove} disabled={stages.length === 1} aria-label={t("wizard.removeStage")}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="wiz-stage-fields">
        <label className="field">
          {t("wizard.duration")}
          <input
            type="number"
            min={1}
            max={365}
            value={Number.isNaN(stage.durationDays) ? "" : stage.durationDays}
            onChange={(e) => onChange({ durationDays: e.target.valueAsNumber })}
          />
        </label>
        <label className="field">
          {t("stageForm.side")}
          <select value={stage.side} onChange={(e) => onChange({ side: e.target.value as ResponsibleSide })}>
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {t(`side.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("stageForm.owner")}
          <select value={stage.ownerId ?? ""} onChange={(e) => onChange({ ownerId: e.target.value || null })}>
            <option value="">{t("work.unassigned")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <div className="wiz-stage-dates">
          {dates ? (
            <>
              <span>{formatDate(dates.plannedStart, i18n.language)}</span>
              <ChevronRight size={14} aria-hidden="true" />
              <span>{formatDate(dates.plannedEnd, i18n.language)}</span>
            </>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </div>

      <p className="wiz-stage-summary muted small">
        {stage.dependsOn.length
          ? t("wizard.startsAfter", { stages: stage.dependsOn.map(order).filter((n) => n > 0).join(", ") })
          : t("wizard.startsAtBeginning")}
        {" · "}
        {t("wizard.tasksCount", { count: tasks })}
        {" · "}
        {t("wizard.requestsCount", { count: stage.requests.length })}
      </p>

      <details className="wiz-more">
        <summary>{t("wizard.moreDetails")}</summary>
        <div className="stack">
          <label className="field">
            {t("stageForm.description")}
            <textarea rows={2} value={stage.description} onChange={(e) => onChange({ description: e.target.value })} maxLength={2000} />
          </label>

          {others.length > 0 && (
            <fieldset className="wiz-deps">
              <legend>{t("wizard.dependsOn")}</legend>
              {others.map((o) => (
                <label key={o.key} className="check">
                  <input
                    type="checkbox"
                    checked={stage.dependsOn.includes(o.key)}
                    onChange={(e) =>
                      onChange({ dependsOn: e.target.checked ? [...stage.dependsOn, o.key] : stage.dependsOn.filter((d) => d !== o.key) })
                    }
                  />
                  {order(o.key)} · {o.name || t("wizard.untitled")}
                </label>
              ))}
            </fieldset>
          )}

          <div className="wiz-flags">
            <label className="check">
              <input type="checkbox" checked={stage.clientVisible} onChange={(e) => onChange({ clientVisible: e.target.checked })} />
              {t("wizard.clientVisible")}
            </label>
            <label className="check">
              <input type="checkbox" checked={stage.requiresEvidence} onChange={(e) => onChange({ requiresEvidence: e.target.checked })} />
              {t("wizard.requiresEvidence")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={stage.requiresClientApproval}
                onChange={(e) => onChange({ requiresClientApproval: e.target.checked })}
              />
              {t("wizard.requiresClientApproval")}
            </label>
          </div>

          <label className="field">
            {t("wizard.checklist")}
            <textarea rows={3} value={stage.checklist.join("\n")} onChange={(e) => onChange({ checklist: e.target.value.split("\n") })} />
            <span className="hint">{t("wizard.checklistHint")}</span>
          </label>

          <div className="wiz-requests">
            <span className="mini-title">{t("impl.clientRequests")}</span>
            {stage.requests.map((r, i) => (
              <div key={i} className="wiz-request">
                <input
                  value={r.title}
                  onChange={(e) => setRequest(i, { title: e.target.value })}
                  placeholder={t("requestForm.whatHint")}
                  aria-label={t("requestForm.what")}
                  maxLength={200}
                />
                <select value={r.type} onChange={(e) => setRequest(i, { type: e.target.value as ClientRequestType })} aria-label={t("requestForm.type")}>
                  {REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`requestType.${type}`)}
                    </option>
                  ))}
                </select>
                <label className="inline-field" title={t("wizard.dueInDaysHint")}>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={Number.isNaN(r.dueInDays) ? "" : r.dueInDays}
                    onChange={(e) => setRequest(i, { dueInDays: e.target.valueAsNumber })}
                  />
                  {t("wizard.dueInDays")}
                </label>
                <label className="check">
                  <input type="checkbox" checked={r.blocking} onChange={(e) => setRequest(i, { blocking: e.target.checked })} />
                  {t("wizard.blocking")}
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onChange({ requests: stage.requests.filter((_, j) => j !== i) })}
                  aria-label={t("wizard.removeRequest")}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => onChange({ requests: [...stage.requests, blankRequest()] })}>
              <Plus size={14} aria-hidden="true" /> {t("wizard.addRequest")}
            </button>
          </div>
        </div>
      </details>
    </li>
  );
}

export function ImplementationWizard({ onCancel }: { onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const clients = useApi(() => adminApi.clients(), []);
  const templates = useApi(() => adminApi.templates("implementation"), []);
  const users = useApi(() => adminApi.assignableUsers(), []);
  const { busy, error, run, clearError } = useAction();

  const [step, setStep] = useState(0);
  const [info, setInfo] = useState({ title: "", clientId: "", assigneeId: user?.id ?? "", plannedStart: todayDay(), dueAt: "" });
  const [newClient, setNewClient] = useState<string | null>(null);
  const [source, setSource] = useState<"template" | "manual">("template");
  const [templateId, setTemplateId] = useState("");
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [stages, setStages] = useState<PlanStageInput[]>([]);
  const [preview, setPreview] = useState<PlanPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSeq = useRef(0);

  const setField = (key: keyof typeof info) => (e: { target: { value: string } }) => setInfo({ ...info, [key]: e.target.value });
  const payload = useMemo(() => toPayload(stages), [stages]);
  const payloadJson = JSON.stringify(payload);
  const stagesValid = payload.length > 0 && payload.every((s) => s.name && validDuration(s.durationDays) && s.requests.every((r) => Number.isInteger(r.dueInDays) && r.dueInDays >= 0 && r.dueInDays <= 365));
  const datesByKey = new Map((preview?.stages ?? []).map((s) => [s.key, s]));
  const userName = (id?: string | null) => (users.data ?? []).find((u) => u.id === id)?.name ?? t("work.unassigned");
  const clientName = (clients.data ?? []).find((c) => c.id === info.clientId)?.name ?? "";
  const templateName = (templates.data ?? []).find((tpl) => tpl.id === templateId)?.name;

  useEffect(() => {
    if (step < 2 || !stagesValid) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await plansApi.preview({ startDay: info.plannedStart || undefined, plan: { stages: payload } });
        if (seq !== previewSeq.current) return;
        setPreview(result);
        setPreviewError(null);
      } catch (err) {
        if (seq === previewSeq.current) setPreviewError(err instanceof Error ? err.message : String(err));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [step, payloadJson, info.plannedStart, stagesValid]);

  const updateStage = (key: string, patch: Partial<PlanStageInput>) => setStages((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const moveStage = (index: number, delta: -1 | 1) =>
    setStages((list) => {
      const next = [...list];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      return next;
    });
  const removeStage = (key: string) =>
    setStages((list) => list.filter((s) => s.key !== key).map((s) => ({ ...s, dependsOn: s.dependsOn.filter((d) => d !== key) })));

  async function createClient() {
    const name = newClient?.trim();
    if (!name) return;
    const client = await run(() => adminApi.createClient({ name }));
    if (!client) return;
    clients.setData([...(clients.data ?? []), client].sort((a, b) => a.name.localeCompare(b.name)));
    setInfo({ ...info, clientId: client.id });
    setNewClient(null);
  }

  async function choosePlan() {
    const origin = source === "template" ? templateId : "manual";
    if (origin !== loadedFrom) {
      if (source === "template") {
        const result = await run(() => plansApi.preview({ templateId, startDay: info.plannedStart || undefined }));
        if (!result) return;
        setStages(result.stages.length ? result.stages.map(fromPreview) : [blankStage()]);
        setPreview(result.stages.length ? result : null);
      } else {
        setStages([blankStage()]);
        setPreview(null);
      }
      setPreviewError(null);
      setLoadedFrom(origin);
    }
    setStep(2);
  }

  async function create() {
    const item = await run(() =>
      workItemsApi.create({
        type: "implementation",
        title: info.title.trim(),
        clientId: info.clientId || null,
        assigneeId: info.assigneeId || null,
        plannedStart: info.plannedStart || null,
        dueAt: info.dueAt || null,
        templateId: loadedFrom && loadedFrom !== "manual" ? loadedFrom : null,
        plan: { stages: payload },
      }),
    );
    if (item) navigate(`/implementaciones/${item.id}`);
  }

  const canNext = [Boolean(info.title.trim() && info.clientId), source === "manual" || Boolean(templateId), stagesValid && !previewError, true][step];

  async function next() {
    clearError();
    if (step === 1) await choosePlan();
    else setStep(step + 1);
  }

  return (
    <section className="card form-card wizard" aria-labelledby="wizard-title">
      <div className="card-head">
        <h2 className="card-title" id="wizard-title">
          {t("impl.new")}
        </h2>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>
            <button type="button" disabled={i >= step} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
              <span className="wizard-step-num">{i < step ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
              {t(`wizard.steps.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="form-grid">
          <label className="field full-row">
            {t("work.fields.title")}
            <input value={info.title} onChange={setField("title")} required maxLength={200} autoFocus placeholder={t("wizard.titleHint")} />
          </label>
          <div className="field">
            <label htmlFor="wiz-client">{t("work.fields.client")}</label>
            {newClient === null ? (
              <>
                <select id="wiz-client" value={info.clientId} onChange={setField("clientId")} required>
                  <option value="">{t("common.choose")}</option>
                  {(clients.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {can("client.manage") && (
                  <button type="button" className="link-btn" onClick={() => setNewClient("")}>
                    <Plus size={14} aria-hidden="true" /> {t("wizard.newClient")}
                  </button>
                )}
              </>
            ) : (
              <div className="wiz-inline">
                <input
                  id="wiz-client"
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder={t("wizard.newClientName")}
                  maxLength={160}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createClient();
                    }
                  }}
                />
                <button type="button" className="btn btn-primary-sm" disabled={busy || !newClient.trim()} onClick={() => void createClient()}>
                  {t("wizard.createClient")}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setNewClient(null)}>
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
          <label className="field">
            {t("work.fields.assignee")}
            <select value={info.assigneeId} onChange={setField("assigneeId")}>
              <option value="">{t("work.unassigned")}</option>
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("impl.plannedStart")}
            <input type="date" value={info.plannedStart} onChange={setField("plannedStart")} required />
          </label>
          <label className="field">
            {t("work.fields.due")}
            <input type="date" value={info.dueAt} onChange={setField("dueAt")} />
            <span className="hint">{t("wizard.dueHint")}</span>
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="wiz-sources">
          {(templates.data ?? []).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className={`wiz-source${source === "template" && templateId === tpl.id ? " on" : ""}`}
              onClick={() => {
                setSource("template");
                setTemplateId(tpl.id);
              }}
            >
              <LayoutTemplate size={20} aria-hidden="true" />
              <strong>{tpl.name}</strong>
              <span className="muted small">{t("wizard.stageCount", { count: tpl.stageCount })}</span>
              {tpl.description && <span className="small">{tpl.description}</span>}
            </button>
          ))}
          <button type="button" className={`wiz-source${source === "manual" ? " on" : ""}`} onClick={() => setSource("manual")}>
            <PenLine size={20} aria-hidden="true" />
            <strong>{t("wizard.manual")}</strong>
            <span className="small">{t("wizard.manualHint")}</span>
          </button>
          {templates.data?.length === 0 && <p className="muted small full-row">{t("wizard.noTemplates")}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <p className="muted small">{t("wizard.stagesLead")}</p>
          <ol className="wiz-stages">
            {stages.map((stage, index) => (
              <StageEditor
                key={stage.key}
                stage={stage}
                index={index}
                stages={stages}
                users={users.data ?? []}
                dates={datesByKey.get(stage.key)}
                onChange={(patch) => updateStage(stage.key, patch)}
                onMove={(delta) => moveStage(index, delta)}
                onRemove={() => removeStage(stage.key)}
              />
            ))}
          </ol>
          <div className="row wiz-stages-foot">
            <button
              type="button"
              className="btn btn-soft"
              disabled={stages.length >= 40}
              onClick={() => setStages([...stages, blankStage(stages[stages.length - 1])])}
            >
              <Plus size={16} aria-hidden="true" /> {t("stageForm.add")}
            </button>
            {preview && !previewError && (
              <span className="muted small">
                {t("wizard.planRange", {
                  start: formatDate(preview.plannedStart, i18n.language),
                  end: formatDate(preview.plannedEnd, i18n.language),
                })}
              </span>
            )}
          </div>
          {!stagesValid && <p className="warn-text small">{t("wizard.stagesInvalid")}</p>}
          {previewError && <p className="form-error">{previewError}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <dl className="wiz-summary">
            <dt>{t("work.fields.title")}</dt>
            <dd>{info.title}</dd>
            <dt>{t("work.fields.client")}</dt>
            <dd>{clientName}</dd>
            <dt>{t("work.fields.assignee")}</dt>
            <dd>{userName(info.assigneeId)}</dd>
            <dt>{t("impl.template")}</dt>
            <dd>{loadedFrom === "manual" ? t("wizard.manual") : templateName}</dd>
            {preview && (
              <>
                <dt>{t("wizard.plan")}</dt>
                <dd>
                  {t("wizard.planRange", {
                    start: formatDate(preview.plannedStart, i18n.language),
                    end: formatDate(preview.plannedEnd, i18n.language),
                  })}
                </dd>
              </>
            )}
            <dt>{t("work.fields.due")}</dt>
            <dd>{info.dueAt ? formatDate(info.dueAt, i18n.language) : preview ? t("wizard.dueFromPlan", { date: formatDate(preview.plannedEnd, i18n.language) }) : "—"}</dd>
          </dl>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("stageForm.name")}</th>
                  <th>{t("stageForm.side")}</th>
                  <th>{t("stageForm.owner")}</th>
                  <th>{t("stageForm.plannedStart")}</th>
                  <th>{t("stageForm.plannedEnd")}</th>
                  <th>{t("wizard.contents")}</th>
                </tr>
              </thead>
              <tbody>
                {payload.map((s, i) => {
                  const d = datesByKey.get(s.key);
                  return (
                    <tr key={s.key}>
                      <td>{i + 1}</td>
                      <td>{s.name}</td>
                      <td>{t(`side.${s.side}`)}</td>
                      <td>{userName(s.ownerId)}</td>
                      <td className="nowrap">{d ? formatDate(d.plannedStart, i18n.language) : "—"}</td>
                      <td className="nowrap">{d ? formatDate(d.plannedEnd, i18n.language) : "—"}</td>
                      <td className="small muted">
                        {t("wizard.tasksCount", { count: s.checklist.length })} · {t("wizard.requestsCount", { count: s.requests.length })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payload.some((s) => s.requests.length > 0) && <p className="muted small">{t("wizard.requestsNotice")}</p>}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="btn-row wizard-foot">
        {step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
            <ChevronLeft size={16} aria-hidden="true" /> {t("wizard.back")}
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary-sm" onClick={() => void next()} disabled={busy || !canNext}>
            {t("wizard.next")} <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn btn-primary-sm" onClick={() => void create()} disabled={busy || !stagesValid || Boolean(previewError)}>
            <Check size={16} aria-hidden="true" /> {t("wizard.create")}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </button>
      </div>
    </section>
  );
}
