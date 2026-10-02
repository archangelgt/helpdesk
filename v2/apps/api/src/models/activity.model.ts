import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { CommentRow, StatusHistoryRow, WorkItemEventRow } from "../types/records.js";

const AUTHOR = "expand.author.id,expand.author.name";

/** Comentarios, historial de estados y eventos de un caso. */
export const activityModel = {
  async comments(workItemId: string, includeInternal: boolean): Promise<CommentRow[]> {
    await ensureAdminAuth();
    const filter = pb.filter(
      includeInternal ? "work_item = {:id}" : "work_item = {:id} && visibility = 'public'",
      { id: workItemId },
    );
    return pb.collection("comments").getFullList<CommentRow>({ filter, sort: "created", expand: "author", fields: `*,${AUTHOR}` });
  },

  async statusHistory(workItemId: string): Promise<StatusHistoryRow[]> {
    await ensureAdminAuth();
    return pb.collection("work_item_status_history").getFullList<StatusHistoryRow>({
      filter: pb.filter("work_item = {:id}", { id: workItemId }),
      sort: "created",
      expand: "changed_by",
      fields: "*,expand.changed_by.id,expand.changed_by.name",
    });
  },

  async events(workItemId: string): Promise<WorkItemEventRow[]> {
    await ensureAdminAuth();
    return pb.collection("work_item_events").getFullList<WorkItemEventRow>({
      filter: pb.filter("work_item = {:id}", { id: workItemId }),
      sort: "created",
      expand: "actor,event_type",
      fields: "*,expand.actor.id,expand.actor.name,expand.event_type.code",
    });
  },
};
