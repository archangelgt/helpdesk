import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { stagesApi, workItemsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ActivityFeed, CommentBox } from "../../components/Activity";
import { Attachments } from "../../components/Attachments";
import { DescriptionCard } from "../../components/DescriptionCard";
import { ErrorNote, Loading } from "../../components/Feedback";
import { Checklist } from "../../components/Checklist";
import { StatusBadge } from "../../components/StatusBadge";
import { TransitionBar } from "../../components/TransitionBar";
import { useAction, useApi } from "../../hooks/useApi";
import { WorkItemFields } from "./WorkItemFields";

/** Detalle de un ticket o una tarea: estado, datos, descripción, checklist y conversación. */
export function WorkItemDetailPage({ section, basePath }: { section: string; basePath: string }) {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const staff = user?.role?.scope === "staff";
  const detail = useApi(() => workItemsApi.get(id), [id]);
  const activity = useApi(() => workItemsApi.activity(id), [id]);
  const [newItem, setNewItem] = useState("");
  const addItem = useAction();

  const back = (
    <Link to={basePath} className="back-link">
      <ArrowLeft size={16} aria-hidden="true" /> {t(`work.back.${section}`)}
    </Link>
  );

  if (detail.error) return <div className="stack">{back}<ErrorNote error={detail.error} onRetry={detail.reload} /></div>;
  if (!detail.data) return <Loading />;
  const item = detail.data;
  const refresh = (updated: typeof item) => {
    detail.setData(updated);
    activity.reload();
  };
  const canEditChecklist = staff && can("work_item.update");

  return (
    <div className="stack">
      {back}
      <section className="card item-head">
        <div className="item-title">
          <span className="number">{item.number}</span>
          <h1>{item.title}</h1>
          <StatusBadge status={item.status} />
        </div>
        <TransitionBar transitions={item.transitions} onApply={async (statusId, comment) => refresh(await workItemsApi.transition(item.id, statusId, comment))} />
      </section>

      <div className="detail-grid">
        <div className="stack">
          <DescriptionCard item={item} onChange={refresh} />

          <section className="card">
            <h2 className="card-title">{t("files.title")}</h2>
            <Attachments workItemId={item.id} files={item.attachments} canUpload={can("comment.create_public")} onChange={detail.reload} />
          </section>

          {(item.checklist.length > 0 || canEditChecklist) && (
            <section className="card">
              <h2 className="card-title">{t("work.checklist")}</h2>
              <Checklist
                items={item.checklist}
                editable={canEditChecklist}
                onToggle={async (checkId, done) => refresh(await stagesApi.setChecklistDone(checkId, done))}
              />
              {canEditChecklist && (
                <form
                  className="inline-add"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newItem.trim()) return;
                    const updated = await addItem.run(() => workItemsApi.addChecklistItem(item.id, newItem.trim()));
                    if (updated) {
                      refresh(updated);
                      setNewItem("");
                    }
                  }}
                >
                  <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("work.addChecklist")} maxLength={200} disabled={addItem.busy} />
                  {addItem.error && <p className="form-error">{addItem.error}</p>}
                </form>
              )}
            </section>
          )}

          <section className="card">
            <h2 className="card-title">{t("activity.title")}</h2>
            <CommentBox
              onSend={async (body, visibility) => {
                activity.setData(await workItemsApi.comment(item.id, body, visibility));
                detail.reload();
              }}
            />
            {activity.data ? <ActivityFeed items={activity.data} /> : <Loading />}
          </section>
        </div>

        <aside className="card side-panel">
          <WorkItemFields item={item} onChange={refresh} />
        </aside>
      </div>
    </div>
  );
}
