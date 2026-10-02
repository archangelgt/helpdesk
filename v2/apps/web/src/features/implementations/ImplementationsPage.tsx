import { useTranslation } from "react-i18next";
import { ImplementationCard } from "./ImplementationCard";
import { SAMPLE_IMPLEMENTATIONS } from "./sampleData";

export function ImplementationsPage() {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("impl.title")}</h1>
        <p className="muted">{t("impl.subtitle")}</p>
      </header>
      <div className="card-grid">
        {SAMPLE_IMPLEMENTATIONS.map((impl) => (
          <ImplementationCard key={impl.id} impl={impl} />
        ))}
      </div>
    </div>
  );
}
