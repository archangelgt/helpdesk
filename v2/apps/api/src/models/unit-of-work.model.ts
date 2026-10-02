import { newBatch } from "../db/pocketbase.js";

export type WriteOp =
  | { op: "create"; collection: string; data: Record<string, unknown> }
  | { op: "update"; collection: string; id: string; data: Record<string, unknown> }
  | { op: "delete"; collection: string; id: string };

/** Aplica varias escrituras en un solo batch de PocketBase: todas o ninguna. */
export const unitOfWork = {
  async commit(ops: WriteOp[]): Promise<void> {
    if (!ops.length) return;
    const batch = await newBatch();
    for (const op of ops) {
      const collection = batch.collection(op.collection);
      if (op.op === "create") collection.create(op.data);
      else if (op.op === "update") collection.update(op.id, op.data);
      else collection.delete(op.id);
    }
    await batch.send();
  },
};
