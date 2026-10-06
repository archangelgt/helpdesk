import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type {
  EventTypeRow,
  NamedRow,
  PriorityRow,
  StatusRow,
  TransitionRow,
  WorkflowRow,
  WorkItemTypeRow,
} from "../types/records.js";

export interface CatalogRows {
  workflows: WorkflowRow[];
  types: WorkItemTypeRow[];
  statuses: StatusRow[];
  transitions: TransitionRow[];
  priorities: PriorityRow[];
  categories: NamedRow[];
  products: NamedRow[];
  channels: NamedRow[];
  eventTypes: EventTypeRow[];
}

export const catalogModel = {
  /** Todos los catálogos de una vez: son pocos registros y casi todas las operaciones los necesitan. */
  async loadAll(): Promise<CatalogRows> {
    await ensureAdminAuth();
    const [workflows, types, statuses, transitions, priorities, categories, products, channels, eventTypes] =
      await Promise.all([
        pb.collection("workflows").getFullList<WorkflowRow>({ sort: "code" }),
        pb.collection("work_item_types").getFullList<WorkItemTypeRow>({ sort: "sort_order" }),
        pb.collection("statuses").getFullList<StatusRow>({ sort: "workflow,sort_order" }),
        pb.collection("workflow_transitions").getFullList<TransitionRow>(),
        pb.collection("priorities").getFullList<PriorityRow>({ sort: "-level" }),
        pb.collection("categories").getFullList<NamedRow>({ sort: "type,sort_order" }),
        pb.collection("products").getFullList<NamedRow>({ sort: "name" }),
        pb.collection("channels").getFullList<NamedRow>({ sort: "code" }),
        pb.collection("event_types").getFullList<EventTypeRow>({ fields: "id,code,client_visible" }),
      ]);
    return { workflows, types, statuses, transitions, priorities, categories, products, channels, eventTypes };
  },
};
