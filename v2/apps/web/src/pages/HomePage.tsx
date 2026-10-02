import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { SAMPLE_IMPLEMENTATIONS } from "../features/implementations/sampleData";
import { ImplementationCard } from "../features/implementations/ImplementationCard";
import { daysUntil, openClientRequests, requestsToReview } from "../utils/progress";

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const impls = SAMPLE_IMPLEMENTATIONS;
  const counters = [
    { key: "waitingMe", value: 0 },
    { key: "assigned", value: impls.length },
    { key: "toReview", value: impls.reduce((n, i) => n + requestsToReview(i).length, 0) },
    { key: "waitingClient", value: impls.reduce((n, i) => n + openClientRequests(i).length, 0) },
    { key: "overdue", value: impls.filter((i) => daysUntil(i.dueDate) < 0).length },
  ];

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("home.title")}</h1>
        <p className="muted">
          {t("home.greeting", { name: user?.name.split(" ")[0] ?? "" })} {t("home.subtitle")}
        </p>
      </header>
      <div className="counters">
        {counters.map((c) => (
          <div key={c.key} className={`card counter ${c.key}`}>
            <span className="counter-value">{c.value}</span>
            <span className="counter-label">{t(`home.counters.${c.key}`)}</span>
          </div>
        ))}
      </div>
      <h2 className="section-title">{t("home.myImplementations")}</h2>
      <div className="card-grid">
        {impls.map((impl) => (
          <ImplementationCard key={impl.id} impl={impl} />
        ))}
      </div>
    </div>
  );
}
