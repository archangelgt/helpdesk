import { ClientResponseError } from "pocketbase";
import { anyOf, ensureAdminAuth, pb, pbDate } from "../db/pocketbase.js";
import type { StatusCategory, WorkItemRow } from "../types/records.js";

const COLLECTION = "work_items";
const EXPAND = "client,assignee,requester,created_by";
const REL_FIELDS = ["client", "assignee", "requester", "created_by"]
  .map((r) => `expand.${r}.id,expand.${r}.name,expand.${r}.email`)
  .join(",");
const FIELDS = `*,${REL_FIELDS}`;

export interface WorkItemCriteria {
  /** Filtro de visibilidad del actor (models/visibility.ts). */
  visibility: string;
  typeId?: string;
  categories?: StatusCategory[];
  statusId?: string;
  /** null = sin asignar. */
  assigneeId?: string | null;
  clientId?: string;
  search?: string;
  dueBefore?: Date;
}

function toFilter(c: WorkItemCriteria): string {
  const parts = [c.visibility];
  if (c.typeId) parts.push(pb.filter("type = {:t}", { t: c.typeId }));
  if (c.categories?.length) parts.push(anyOf("status_category", c.categories));
  if (c.statusId) parts.push(pb.filter("status = {:s}", { s: c.statusId }));
  if (c.assigneeId === null) parts.push('assignee = ""');
  else if (c.assigneeId) parts.push(pb.filter("assignee = {:a}", { a: c.assigneeId }));
  if (c.clientId) parts.push(pb.filter("client = {:c}", { c: c.clientId }));
  if (c.search) parts.push(pb.filter("(title ~ {:q} || number ~ {:q})", { q: c.search }));
  if (c.dueBefore) parts.push(pb.filter('due_at != "" && due_at < {:d}', { d: pbDate(c.dueBefore) }));
  return parts.filter(Boolean).join(" && ");
}

export const workItemsModel = {
  async list(criteria: WorkItemCriteria, sort: string, page: number, perPage: number) {
    await ensureAdminAuth();
    return pb.collection(COLLECTION).getList<WorkItemRow>(page, perPage, {
      filter: toFilter(criteria),
      sort: `${sort},-id`,
      expand: EXPAND,
      fields: FIELDS,
    });
  },

  async count(criteria: WorkItemCriteria): Promise<number> {
    await ensureAdminAuth();
    const result = await pb.collection(COLLECTION).getList(1, 1, { filter: toFilter(criteria), fields: "id" });
    return result.totalItems;
  },

  async findById(id: string): Promise<WorkItemRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection(COLLECTION).getOne<WorkItemRow>(id, { expand: EXPAND, fields: FIELDS });
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  /** Busca un caso por id solo si el actor puede verlo. */
  async findVisible(id: string, visibility: string): Promise<WorkItemRow | null> {
    await ensureAdminAuth();
    const filter = [pb.filter("id = {:id}", { id }), visibility].filter(Boolean).join(" && ");
    const result = await pb.collection(COLLECTION).getList<WorkItemRow>(1, 1, { filter, expand: EXPAND, fields: FIELDS });
    return result.items[0] ?? null;
  },

  /** Asignaciones abiertas (sin ended_at) del caso, para cerrarlas al reasignar. */
  async openAssignmentIds(workItemId: string): Promise<string[]> {
    await ensureAdminAuth();
    const rows = await pb.collection("work_item_assignments").getFullList({
      filter: pb.filter("work_item = {:id} && stage = '' && ended_at = ''", { id: workItemId }),
      fields: "id",
    });
    return rows.map((r) => r.id);
  },
};
