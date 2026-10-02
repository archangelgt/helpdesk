import { ClientResponseError } from "pocketbase";
import { anyOf, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { ClientRequestRow, ClientRequestStatus } from "../types/records.js";

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

  /**
   * Cuenta requerimientos en ciertos estados sobre los casos que cumplen `workItemFilter` (con prefijo `work_item.`).
   * Solo cuenta los accionables: sin etapa o de una etapa ya iniciada y no terminada.
   */
  async countActionable(statuses: ClientRequestStatus[], workItemFilter: string): Promise<number> {
    await ensureAdminAuth();
    const activeStage = `(stage = "" || (stage.status.category != "new" && stage.status.category != "closed" && stage.status.category != "cancelled"))`;
    const filter = [anyOf("status", statuses), activeStage, workItemFilter].filter(Boolean).join(" && ");
    const result = await pb.collection("client_requests").getList(1, 1, { filter, fields: "id" });
    return result.totalItems;
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
