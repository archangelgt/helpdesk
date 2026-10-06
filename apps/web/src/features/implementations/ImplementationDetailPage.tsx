import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, Inbox, Pencil, Plus } from "lucide-react";
import { stagesApi, workItemsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ActivityFeed, CommentBox } from "../../components/Activity";
import { Attachments } from "../../components/Attachments";
import { DescriptionCard } from "../../components/DescriptionCard";
import { Checklist } from "../../components/Checklist";
import { DueLabel } from "../../components/DueLabel";
import { ErrorNote, Loading } from "../../components/Feedback";
import { ProgressBar, ProgressRing } from "../../components/Progress";
import { StatusBadge } from "../../components/StatusBadge";
import { TransitionBar } from "../../components/TransitionBar";
import { useAction, useApi } from "../../hooks/useApi";
import type { StageDto, WorkItemDetailDto } from "../../types/api";
import { formatDate } from "../../utils/dates";
import { WorkItemFields } from "../work-items/WorkItemFields";
import { ClientRequestRow } from "./ClientRequestRow";
import { AddStageForm, EditStageForm, NewClientRequestForm } from "./StageForms";

function StageDates({ stage }: { stage: StageDto }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  if (!stage.plannedStart && !stage.plannedEnd) return <span>{t("impl.ongoing")}</span>;
  return (
    <span>
      {stage.plannedStart ? formatDate(stage.plannedStart, lang) : "…"} – {stage.plannedEnd ? formatDate(stage.plannedEnd, lang) : "…"}
    </span>
  );
}

function StagePanel({ item, stage, onChange, onReload }: { item: WorkItemDetailDto; stage: StageDto; onChange: (item: WorkItemDetailDto) => void; onReload: () => void }) {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const staff = user?.role?.scope === "staff";
  const canManage = staff && can("stage.manage");
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState("");
  const add = useAction();
  const done = stage.checklist.filter((c) => c.isDone).length;

  return (
    <section className="card stage-current">
      <div className="stage-head">
        <span className="stage-num">{stage.order}</span>
        <strong>{stage.name}</strong>
        <StatusBadge status={stage.status} />
        <span className="stage-meta">
          {stage.checklist.length > 0 && <>{t("impl.tasksCount", { done, total: stage.checklist.length })} · </>}
          <StageDates stage={stage} />
        </span>
        {canManage && !editing && (
          <button type="button" className="icon-link" onClick={() => setEditing(true)} aria-label={t("stageForm.edit")} title={t("stageForm.edit")}>
            <Pencil size={15} />
          </button>
        )}
      </div>
      {editing && (
        <EditStageForm
          stage={stage}
          onDone={(updated) => {
            onChange(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
      {stage.owner && <p className="muted small stage-desc">{t("stageForm.ownerIs", { name: stage.owner.name })}</p>}
      {!editing && stage.description && <p className="muted small stage-desc">{stage.description}</p>}
      <ProgressBar value={stage.progress} />
      <Checklist items={stage.checklist} editable={canManage} onToggle={async (id, isDone) => onChange(await stagesApi.setChecklistDone(id, isDone))} />
      {canManage && (
        <form
          className="inline-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            const updated = await add.run(() => stagesApi.addChecklistItem(stage.id, newItem.trim()));
            if (updated) {
              onChange(updated);
              setNewItem("");
            }
          }}
        >
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("work.addChecklist")} maxLength={200} disabled={add.busy} />
          {add.error && <p className="form-error">{add.error}</p>}
        </form>
      )}
      {(staff || item.attachments.some((f) => f.stageId === stage.id)) && (
        <div className="stage-files">
          <h3 className="mini-title">{t("files.stageTitle")}</h3>
          <Attachments workItemId={item.id} files={item.attachments} stageId={stage.id} canUpload={staff && can("comment.create_public")} onChange={onReload} />
        </div>
      )}
      <TransitionBar transitions={stage.transitions} onApply={async (statusId, comment) => onChange(await stagesApi.transition(stage.id, statusId, comment))} />
    </section>
  );
}

export function ImplementationDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const isClient = user?.role?.scope === "client";
  const canManageStages = !isClient && can("stage.manage");
  const canAskClient = !isClient && can("client_request.create");
  const lang = i18n.resolvedLanguage ?? "es";
  const detail = useApi(() => workItemsApi.get(id), [id]);
  const activity = useApi(() => workItemsApi.activity(id), [id]);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<"stage" | "request" | null>(null);

  const back = (
    <Link to="/implementaciones" className="back-link">
      <ArrowLeft size={16} aria-hidden="true" /> {t("impl.back")}
    </Link>
  );

  if (detail.error) return <div className="stack">{back}<ErrorNote error={detail.error} onRetry={detail.reload} /></div>;
  if (!detail.data) return <Loading />;

  const impl = detail.data;
  const refresh = (updated: WorkItemDetailDto) => {
    detail.setData(updated);
    activity.reload();
  };
  const formDone = (updated: WorkItemDetailDto) => {
    refresh(updated);
    setForm(null);
  };
  const currentId = impl.implementation?.currentStage?.id ?? null;
  const shown = impl.stages.find((s) => s.id === (selected ?? currentId)) ?? null;
  const stageName = (stageId: string | null) => impl.stages.find((s) => s.id === stageId)?.name;
  const waiting = impl.clientRequests.filter((r) => r.status === "pending" || r.status === "rejected");
  const actionableWaiting = waiting.filter((r) => {
    const stage = impl.stages.find((s) => s.id === r.stageId);
    return !stage || stage.status.category !== "new";
  });
  const toReview = impl.clientRequests.filter((r) => r.status === "submitted" || r.status === "in_review");

  return (
    <div className="stack">
      {back}

      <section className="card hero">
        <ProgressRing value={impl.progressPercent} />
        <div className="hero-main">
          <span className="number">{impl.number}</span>
          <h1>{impl.title}</h1>
          <p className="muted">
            {impl.client && (
              <>
                {t("impl.client")}: {impl.client.name} ·{" "}
              </>
            )}
            {impl.dueAt && <>{t("impl.due", { date: formatDate(impl.dueAt, lang) })} · </>}
            <DueLabel date={impl.dueAt} done={impl.status.isFinal} />
          </p>
          <div className="hero-status">
            <StatusBadge status={impl.status} />
            <TransitionBar transitions={impl.transitions} compact onApply={async (statusId, comment) => refresh(await workItemsApi.transition(impl.id, statusId, comment))} />
          </div>
        </div>
      </section>

      {!isClient && (
        <details className="card fields-card">
          <summary>{t("impl.details")}</summary>
          <WorkItemFields item={impl} onChange={refresh} />
        </details>
      )}

      {(impl.description || !isClient) && <DescriptionCard item={impl} onChange={refresh} />}

      {actionableWaiting.length > 0 && (
        <section className="card waiting-box">
          <h2 className="waiting-title">
            <AlertCircle size={18} aria-hidden="true" /> {t("impl.waitingTitle", { count: actionableWaiting.length })}
          </h2>
          <p className="muted small">{isClient ? t("impl.waitingLeadClient") : t("impl.waitingLead")}</p>
          <ul className="requests">
            {actionableWaiting.map((r) => (
              <ClientRequestRow key={r.id} request={r} stageName={stageName(r.stageId)} files={impl.attachments} workItemId={impl.id} onReload={detail.reload} onChange={refresh} />
            ))}
          </ul>
        </section>
      )}

      {toReview.length > 0 && (
        <section className="card review-box">
          <h2 className="review-title">
            <Inbox size={18} aria-hidden="true" /> {isClient ? t("impl.deliveredTitle", { count: toReview.length }) : t("impl.reviewTitle", { count: toReview.length })}
          </h2>
          <ul className="requests">
            {toReview.map((r) => (
              <ClientRequestRow key={r.id} request={r} stageName={stageName(r.stageId)} files={impl.attachments} workItemId={impl.id} onReload={detail.reload} onChange={refresh} />
            ))}
          </ul>
        </section>
      )}

      {shown && (
        <>
          <h2 className="section-title">
            {shown.id === currentId ? t("impl.currentStage", { order: shown.order, name: shown.name }) : t("impl.selectedStage", { order: shown.order, name: shown.name })}
          </h2>
          <StagePanel item={impl} stage={shown} onChange={refresh} onReload={detail.reload} />
        </>
      )}

      <div className="section-head">
        <h2 className="section-title">{t("impl.stages")}</h2>
        {canManageStages && form !== "stage" && (
          <button type="button" className="btn btn-ghost" onClick={() => setForm("stage")}>
            <Plus size={15} aria-hidden="true" /> {t("stageForm.add")}
          </button>
        )}
      </div>
      {form === "stage" && <AddStageForm item={impl} onDone={formDone} onCancel={() => setForm(null)} />}
      {impl.stages.length === 0 && form !== "stage" && (
        <p className="muted">{canManageStages ? t("impl.noStagesManage") : t("impl.noStages")}</p>
      )}
      <div className="stage-grid">
        {impl.stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={`card stage-card${stage.id === shown?.id ? " active" : ""}`}
            onClick={() => setSelected(stage.id)}
            aria-pressed={stage.id === shown?.id}
          >
            <div className="stage-head">
              <span className="stage-num">{stage.order}</span>
              <strong>{stage.name}</strong>
              <span className="stage-meta">
                <StatusBadge status={stage.status} />
              </span>
            </div>
            <ProgressBar value={stage.progress} />
            <p className="muted small">{stage.description || stage.checklist.slice(0, 3).map((c) => c.title).join(" · ")}</p>
            <p className="stage-foot">
              <StageDates stage={stage} />
              <span className={`side ${stage.side}`}>{t("impl.dependsOn", { side: t(`side.${stage.side}`) })}</span>
            </p>
          </button>
        ))}
      </div>

      {(impl.clientRequests.length > 0 || canAskClient) && (
        <>
          <div className="section-head">
            <h2 className="section-title">{t("impl.clientRequests")}</h2>
            {canAskClient && form !== "request" && (
              <button type="button" className="btn btn-ghost" onClick={() => setForm("request")}>
                <Plus size={15} aria-hidden="true" /> {t("requestForm.open")}
              </button>
            )}
          </div>
          {form === "request" && (
            <NewClientRequestForm item={impl} defaultStageId={shown?.id} onDone={formDone} onCancel={() => setForm(null)} />
          )}
          {impl.clientRequests.length > 0 ? (
            <section className="card">
              <ul className="requests">
                {impl.clientRequests.map((r) => (
                  <ClientRequestRow key={r.id} request={r} stageName={stageName(r.stageId)} files={impl.attachments} workItemId={impl.id} onReload={detail.reload} onChange={refresh} readOnly />
                ))}
              </ul>
            </section>
          ) : (
            form !== "request" && <p className="muted">{t("impl.noRequests")}</p>
          )}
        </>
      )}

      <h2 className="section-title">{t("files.title")}</h2>
      <section className="card">
        <Attachments workItemId={impl.id} files={impl.attachments} canUpload={can("comment.create_public")} onChange={detail.reload} />
      </section>

      <h2 className="section-title">{t("impl.log")}</h2>
      <section className="card">
        <CommentBox
          onSend={async (body, visibility) => {
            activity.setData(await workItemsApi.comment(impl.id, body, visibility));
            detail.reload();
          }}
        />
        {activity.data ? <ActivityFeed items={activity.data} /> : <Loading />}
      </section>
    </div>
  );
}
