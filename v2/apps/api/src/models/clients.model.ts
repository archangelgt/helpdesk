import type { RecordModel } from "pocketbase";
import { ensureAdminAuth, pb } from "../db/pocketbase.js";

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
};
