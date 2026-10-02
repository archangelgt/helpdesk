import { useTranslation } from "react-i18next";
import { daysUntil } from "../utils/dates";

export function DueLabel({ date, done = false }: { date: string | null; done?: boolean }) {
  const { t } = useTranslation();
  if (!date) return <span className="due">{t("work.noDueDate")}</span>;
  if (done) return null;
  const days = daysUntil(date);
  return days >= 0 ? (
    <span className="due">{t("impl.daysLeft", { count: days })}</span>
  ) : (
    <span className="due late">{t("impl.daysLate", { count: -days })}</span>
  );
}
