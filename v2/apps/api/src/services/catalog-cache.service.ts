import { CATALOG_CACHE_TTL_MS } from "../config/constants.js";
import { catalogModel, type CatalogRows } from "../models/catalog.model.js";
import type { StatusRow, TransitionRow, WorkItemTypeRow } from "../types/records.js";
import { Errors } from "../utils/errors.js";

export interface Catalog extends CatalogRows {
  typeById: Map<string, WorkItemTypeRow>;
  statusById: Map<string, StatusRow>;
  priorityById: Map<string, CatalogRows["priorities"][number]>;
  /** Estado inicial de cada flujo. */
  initialStatus(workflowId: string): StatusRow;
  /** Estado de un flujo por código (ej. "en_curso"). */
  statusByCode(workflowId: string, code: string): StatusRow | undefined;
  transition(fromStatus: string, toStatus: string): TransitionRow | undefined;
  transitionsFrom(fromStatus: string): TransitionRow[];
  typeByCode(code: string): WorkItemTypeRow | undefined;
  eventTypeId(code: string): string | undefined;
}

let cached: { catalog: Catalog; expires: number } | null = null;
let loading: Promise<Catalog> | null = null;

function build(rows: CatalogRows): Catalog {
  const typeById = new Map(rows.types.map((t) => [t.id, t]));
  const statusById = new Map(rows.statuses.map((s) => [s.id, s]));
  const priorityById = new Map(rows.priorities.map((p) => [p.id, p]));
  const transitionKey = new Map(rows.transitions.map((t) => [`${t.from_status}>${t.to_status}`, t]));
  const eventIds = new Map(rows.eventTypes.map((e) => [e.code, e.id]));

  return {
    ...rows,
    typeById,
    statusById,
    priorityById,
    initialStatus(workflowId) {
      const status = rows.statuses.find((s) => s.workflow === workflowId && s.is_initial && s.active);
      if (!status) throw Errors.configuration("workflow_without_initial_status");
      return status;
    },
    statusByCode: (workflowId, code) => rows.statuses.find((s) => s.workflow === workflowId && s.code === code),
    transition: (from, to) => transitionKey.get(`${from}>${to}`),
    transitionsFrom: (from) => rows.transitions.filter((t) => t.from_status === from),
    typeByCode: (code) => rows.types.find((t) => t.code === code),
    eventTypeId: (code) => eventIds.get(code),
  };
}

export const catalogCache = {
  async get(): Promise<Catalog> {
    if (cached && cached.expires > Date.now()) return cached.catalog;
    loading ??= catalogModel
      .loadAll()
      .then((rows) => {
        const catalog = build(rows);
        cached = { catalog, expires: Date.now() + CATALOG_CACHE_TTL_MS };
        return catalog;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  invalidate(): void {
    cached = null;
  },
};
