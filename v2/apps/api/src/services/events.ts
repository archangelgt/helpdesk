import type { WriteOp } from "../models/unit-of-work.model.js";
import type { Catalog } from "./catalog-cache.service.js";

export interface DomainEvent {
  code: string;
  workItemId: string;
  actorId: string | null;
  data?: Record<string, unknown>;
}

/**
 * Un evento queda en la bitácora del caso (work_item_events) y en el outbox (event_outbox),
 * de donde lo tomarán los avisos por correo y los conectores. Ambos dentro del mismo batch.
 */
export function eventOps(catalog: Catalog, events: DomainEvent[]): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const e of events) {
    const eventType = catalog.eventTypeId(e.code);
    if (!eventType) continue;
    ops.push({
      op: "create",
      collection: "work_item_events",
      data: { work_item: e.workItemId, event_type: eventType, actor: e.actorId ?? "", metadata: e.data ?? {} },
    });
    ops.push({
      op: "create",
      collection: "event_outbox",
      data: {
        event_type: eventType,
        aggregate_id: e.workItemId,
        payload: { event: e.code, workItemId: e.workItemId, actorId: e.actorId, ...e.data },
        status: "pending",
        attempts: 0,
      },
    });
  }
  return ops;
}
