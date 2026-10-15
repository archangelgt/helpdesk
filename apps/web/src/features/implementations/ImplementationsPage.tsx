import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { workItemsApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading } from "../../components/Feedback";
import { useApi } from "../../hooks/useApi";
import type { WorkItemView } from "../../types/api";
import { ImplementationCard } from "./ImplementationCard";
import { ImplementationWizard } from "./ImplementationWizard";

const VIEWS: WorkItemView[] = ["open", "done", "all"];

export function ImplementationsPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const [view, setView] = useState<WorkItemView>("open");
  const [creating, setCreating] = useState(false);
  const list = useApi(() => workItemsApi.list({ type: "implementation", view, perPage: 100, sort: "due_at" }), [view]);
  const canCreate = user?.role?.scope === "staff" && can("work_item.create") && can("stage.manage");

  return (
    <div className="stack">
      <header className="page-head row">
        <div>
          <h1>{t("impl.title")}</h1>
          <p className="muted">{t("impl.subtitle")}</p>
        </div>
        {canCreate && !creating && (
          <button type="button" className="btn btn-primary-sm" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {t("impl.new")}
          </button>
        )}
      </header>

      {creating && <ImplementationWizard onCancel={() => setCreating(false)} />}

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {t(`work.views.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.items.length === 0 && <p className="muted">{t("work.empty")}</p>}
      <div className="card-grid">
        {list.data?.items.map((impl) => <ImplementationCard key={impl.id} impl={impl} />)}
      </div>
    </div>
  );
}
