import { ClientResponseError, type RecordModel } from "pocketbase";
import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { ClientRow } from "../types/records.js";

export interface ClientSummary {
  id: string;
  name: string;
}

export const clientsModel = {
  async findSummary(id: string): Promise<ClientSummary | null> {
    if (!id) return null;
    await ensureAdminAuth();
    try {
      return await pb.collection("clients").getOne<ClientSummary & RecordModel>(id, { fields: "id,name" });
    } catch {
      return null;
    }
  },

  async findById(id: string): Promise<ClientRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection("clients").getOne<ClientRow>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  async list(search?: string): Promise<ClientRow[]> {
    await ensureAdminAuth();
    const filter = search
      ? pb.filter("name ~ {:q} || legal_name ~ {:q} || tax_id ~ {:q}", { q: search })
      : "";
    return pb.collection("clients").getFullList<ClientRow>({ filter, sort: "name" });
  },

  async create(data: Partial<Omit<ClientRow, keyof RecordModel>>): Promise<ClientRow> {
    await ensureAdminAuth();
    return pb.collection("clients").create<ClientRow>(data);
  },

  async update(id: string, data: Partial<Omit<ClientRow, keyof RecordModel>>): Promise<ClientRow> {
    await ensureAdminAuth();
    return pb.collection("clients").update<ClientRow>(id, data);
  },

  /** Casos abiertos por cliente, para la lista de clientes. */
  async openWorkItemCounts(): Promise<Map<string, number>> {
    await ensureAdminAuth();
    const rows = await pb.collection("work_items").getFullList<{ client: string } & RecordModel>({
      filter: "client != '' && deleted_at = '' && status_category != 'resolved' && status_category != 'closed' && status_category != 'cancelled'",
      fields: "client",
    });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.client, (counts.get(r.client) ?? 0) + 1);
    return counts;
  },
};
