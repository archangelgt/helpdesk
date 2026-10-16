import { ClientResponseError } from "pocketbase";
import { anyOf, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { ClientRequestRow, ClientRequestStatus, StageRow, WorkItemRow } from "../types/records.js";

export type ClientRequestWithContext = ClientRequestRow & { expand?: { work_item?: WorkItemRow; stage?: StageRow } };

const ACTIVE_STAGE = `(stage = "" || (stage.status.category != "new" && stage.status.category != "closed" && stage.status.category != "cancelled"))`;

/** Accionables: sin etapa o de una etapa ya iniciada y no terminada; para el cliente, solo de etapas que puede ver. */
function actionableFilter(statuses: ClientRequestStatus[], workItemFilter: string, clientView: boolean): string {
  return [anyOf("status", statuses), ACTIVE_STAGE, clientView ? `(stage = "" || stage.client_visible = true)` : "", workItemFilter]
    .filter(Boolean)
    .join(" && ");
}

export const clientRequestsModel = {
  async listByWorkItem(workItemId: string): Promise<ClientRequestRow[]> {
    await ensureAdminAuth();
    return pb.collection("client_requests").getFullList<ClientRequestRow>({
      filter: pb.filter("work_item = {:id} && status != 'cancelled'", { id: workItemId }),
      sort: "due_at,created",
    });
  },

  async listByWorkItems(workItemIds: string[], statuses: ClientRequestStatus[]): Promise<ClientRequestRow[]> {
    if (!workItemIds.length) return [];
    await ensureAdminAuth();
    return pb.collection("client_requests").getFullList<ClientRequestRow>({
      filter: `${anyOf("work_item", workItemIds)} && ${anyOf("status", statuses)}`,
      fields: "id,work_item,status,blocking",
    });
  },

  /** Cuenta requerimientos accionables en ciertos estados sobre los casos que cumplen `workItemFilter` (con prefijo `work_item.`). */
  async countActionable(statuses: ClientRequestStatus[], workItemFilter: string, clientView = false): Promise<number> {
    await ensureAdminAuth();
    const result = await pb.collection("client_requests").getList(1, 1, { filter: actionableFilter(statuses, workItemFilter, clientView), fields: "id" });
    return result.totalItems;
  },

  async listActionable(statuses: ClientRequestStatus[], workItemFilter: string, clientView: boolean, limit: number): Promise<ClientRequestWithContext[]> {
    await ensureAdminAuth();
    const result = await pb.collection("client_requests").getList<ClientRequestWithContext>(1, limit, {
      filter: actionableFilter(statuses, workItemFilter, clientView),
      sort: "created",
      expand: "work_item,stage",
    });
    return result.items;
  },

  async findById(id: string): Promise<ClientRequestRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection("client_requests").getOne<ClientRequestRow>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },
};
