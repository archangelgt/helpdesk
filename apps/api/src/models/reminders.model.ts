import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { ClientRequestRow, StageRow, WorkItemRow } from "../types/records.js";
import { dayToPb } from "../utils/business-days.js";

const OPEN_ITEM = `work_item.deleted_at = "" && work_item.status_category != "resolved" && work_item.status_category != "closed" && work_item.status_category != "cancelled"`;
const ACTIVE_STAGE = `(status.category = "open" || status.category = "in_progress" || status.category = "waiting_client" || status.category = "waiting_internal")`;

export type ReminderRequestRow = Pick<ClientRequestRow, "id" | "work_item" | "stage" | "title" | "due_at" | "reminders_sent" | "last_reminder_at">;
export type OverdueStageRow = Pick<StageRow, "id" | "work_item" | "name" | "planned_end">;
export type OverdueItemRow = Pick<WorkItemRow, "id" | "number" | "due_at">;

/** Consultas del worker de recordatorios. `day` es YYYY-MM-DD en la zona horaria de la empresa. */
export const remindersModel = {
  /** Requerimientos abiertos que vencen hasta `untilDay` (incluidos los ya vencidos), de etapas en curso o sin etapa. */
  async requestsDueBy(untilDay: string): Promise<ReminderRequestRow[]> {
    await ensureAdminAuth();
    const activeStage = `(stage = "" || (stage.status.category != "new" && stage.status.category != "closed" && stage.status.category != "resolved" && stage.status.category != "cancelled"))`;
    return pb.collection("client_requests").getFullList<ReminderRequestRow>({
      filter: [
        `(status = "pending" || status = "rejected")`,
        `due_at != ""`,
        pb.filter("due_at <= {:until}", { until: dayToPb(untilDay) }),
        activeStage,
        OPEN_ITEM,
      ].join(" && "),
      fields: "id,work_item,stage,title,due_at,reminders_sent,last_reminder_at",
      sort: "due_at",
    });
  },

  /** Etapas en curso cuya fecha de fin ya pasó y que todavía no se avisaron. */
  async overdueStages(today: string): Promise<OverdueStageRow[]> {
    await ensureAdminAuth();
    return pb.collection("stages").getFullList<OverdueStageRow>({
      filter: [`planned_end != ""`, pb.filter("planned_end < {:today}", { today: `${today} 00:00:00.000Z` }), `overdue_notified_at = ""`, ACTIVE_STAGE, OPEN_ITEM].join(" && "),
      fields: "id,work_item,name,planned_end",
    });
  },

  /** Casos abiertos con fecha límite vencida que todavía no se avisaron. */
  async overdueItems(today: string): Promise<OverdueItemRow[]> {
    await ensureAdminAuth();
    return pb.collection("work_items").getFullList<OverdueItemRow>({
      filter: [
        `due_at != ""`,
        pb.filter("due_at < {:today}", { today: `${today} 00:00:00.000Z` }),
        `overdue_notified_at = ""`,
        `deleted_at = ""`,
        `status_category != "resolved" && status_category != "closed" && status_category != "cancelled"`,
      ].join(" && "),
      fields: "id,number,due_at",
    });
  },
};
