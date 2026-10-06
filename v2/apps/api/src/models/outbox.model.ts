import type { RecordModel } from "pocketbase";
import { ensureAdminAuth, pb, pbDate } from "../db/pocketbase.js";

export interface OutboxRow extends RecordModel {
  event_type: string;
  aggregate_id: string;
  payload: { event: string; workItemId: string; actorId: string | null; [key: string]: unknown };
  destination: string;
  status: "pending" | "processing" | "delivered" | "failed" | "dead";
  attempts: number;
  next_attempt_at: string;
  last_error: string;
  created: string;
}

export const outboxModel = {
  /** Eventos listos para procesar: pendientes o fallidos cuyo reintento ya venció, en orden de llegada. */
  async due(limit: number): Promise<OutboxRow[]> {
    await ensureAdminAuth();
    const now = pbDate(new Date());
    const res = await pb.collection("event_outbox").getList<OutboxRow>(1, limit, {
      filter: pb.filter("status = 'pending' || (status = 'failed' && next_attempt_at <= {:now})", { now }),
      sort: "created",
    });
    return res.items;
  },

  async markFailed(row: OutboxRow, error: string, maxAttempts: number): Promise<void> {
    await ensureAdminAuth();
    const attempts = row.attempts + 1;
    const delayMs = Math.min(60, 2 ** attempts) * 60_000;
    await pb.collection("event_outbox").update(row.id, {
      status: attempts >= maxAttempts ? "dead" : "failed",
      attempts,
      next_attempt_at: pbDate(new Date(Date.now() + delayMs)),
      last_error: error.slice(0, 2000),
    });
  },

  async countByStatus(): Promise<Record<string, number>> {
    await ensureAdminAuth();
    const statuses = ["pending", "failed", "dead"];
    const counts = await Promise.all(
      statuses.map((status) => pb.collection("event_outbox").getList(1, 1, { filter: pb.filter("status = {:status}", { status }), fields: "id" })),
    );
    return Object.fromEntries(statuses.map((s, i) => [s, counts[i].totalItems]));
  },
};
