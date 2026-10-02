import type { RecordModel } from "pocketbase";
import { ensureAdminAuth, pb } from "../db/pocketbase.js";

export interface WorkItemTypeRow extends RecordModel {
  code: string;
  name: string;
  label_key: string;
  icon: string;
  color: string;
  number_prefix: string;
  has_stages: boolean;
  client_visible: boolean;
  workflow: string;
  stage_workflow: string;
  default_priority: string;
}

export interface StatusRow extends RecordModel {
  code: string;
  name: string;
  label_key: string;
  category: string;
  client_label: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_final: boolean;
  pauses_sla: boolean;
  expand?: { workflow?: { code: string } };
}

export interface PriorityRow extends RecordModel {
  code: string;
  name: string;
  label_key: string;
  level: number;
  color: string;
  is_default: boolean;
}

export const catalogModel = {
  async workItemTypes(): Promise<WorkItemTypeRow[]> {
    await ensureAdminAuth();
    return pb.collection("work_item_types").getFullList<WorkItemTypeRow>({ filter: "active = true", sort: "sort_order" });
  },

  async statuses(workflowCode?: string): Promise<StatusRow[]> {
    await ensureAdminAuth();
    const filter = workflowCode
      ? pb.filter("active = true && workflow.code = {:code}", { code: workflowCode })
      : "active = true";
    return pb.collection("statuses").getFullList<StatusRow>({ filter, sort: "workflow,sort_order", expand: "workflow" });
  },

  async priorities(): Promise<PriorityRow[]> {
    await ensureAdminAuth();
    return pb.collection("priorities").getFullList<PriorityRow>({ filter: "active = true", sort: "-level" });
  },
};
