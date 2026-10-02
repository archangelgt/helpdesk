import { useTranslation } from "react-i18next";
import { daysUntil } from "../../utils/progress";

export function DueLabel({ date }: { date: string }) {
  const { t } = useTranslation();
  const days = daysUntil(date);
  return days >= 0 ? (
    <span className="due">{t("impl.daysLeft", { count: days })}</span>
  ) : (
    <span className="due late">{t("impl.daysLate", { count: -days })}</span>
  );
}
