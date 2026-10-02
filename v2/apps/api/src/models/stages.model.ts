import { ClientResponseError } from "pocketbase";
import { anyOf, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { ChecklistItemRow, StageDependencyRow, StageRow } from "../types/records.js";

export const stagesModel = {
  async listByWorkItem(workItemId: string): Promise<StageRow[]> {
    await ensureAdminAuth();
    return pb.collection("stages").getFullList<StageRow>({
      filter: pb.filter("work_item = {:id}", { id: workItemId }),
      sort: "sort_order,created",
      expand: "owner",
      fields: "*,expand.owner.id,expand.owner.name",
    });
  },

  async listByWorkItems(workItemIds: string[]): Promise<StageRow[]> {
    if (!workItemIds.length) return [];
    await ensureAdminAuth();
    return pb.collection("stages").getFullList<StageRow>({ filter: anyOf("work_item", workItemIds), sort: "sort_order" });
  },

  async findById(id: string): Promise<StageRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection("stages").getOne<StageRow>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  async dependencies(workItemId: string): Promise<StageDependencyRow[]> {
    await ensureAdminAuth();
    return pb.collection("stage_dependencies").getFullList<StageDependencyRow>({
      filter: pb.filter("stage.work_item = {:id}", { id: workItemId }),
    });
  },

  async checklistByStages(stageIds: string[]): Promise<ChecklistItemRow[]> {
    if (!stageIds.length) return [];
    await ensureAdminAuth();
    return pb.collection("checklist_items").getFullList<ChecklistItemRow>({
      filter: anyOf("stage", stageIds),
      sort: "sort_order,created",
    });
  },

  async checklistByWorkItem(workItemId: string): Promise<ChecklistItemRow[]> {
    await ensureAdminAuth();
    return pb.collection("checklist_items").getFullList<ChecklistItemRow>({
      filter: pb.filter("work_item = {:id}", { id: workItemId }),
      sort: "sort_order,created",
    });
  },

  async findChecklistItem(id: string): Promise<ChecklistItemRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection("checklist_items").getOne<ChecklistItemRow>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },
};
