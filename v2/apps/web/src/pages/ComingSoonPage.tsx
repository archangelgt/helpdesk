import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

export function ComingSoonPage({ section, phase }: { section: string; phase: number }) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t(`nav.${section}`)}</h1>
      </header>
      <div className="card soon">
        <Construction size={32} aria-hidden="true" />
        <div>
          <strong>{t("soon.title")}</strong>
          <p className="muted">{t("soon.lead", { phase })}</p>
        </div>
      </div>
    </div>
  );
}
