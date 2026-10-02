import { ClientResponseError } from "pocketbase";
import { anonymousClient, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { UserRecord } from "../types/domain.js";

const COLLECTION = "users";

export const usersModel = {
  async findById(id: string): Promise<UserRecord | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection(COLLECTION).getOne<UserRecord>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  /** Verifica la contraseña contra PocketBase. Devuelve el usuario o null si no coincide. */
  async verifyPassword(email: string, password: string): Promise<UserRecord | null> {
    try {
      const { record } = await anonymousClient().collection(COLLECTION).authWithPassword<UserRecord>(email, password);
      return record;
    } catch (err) {
      if (err instanceof ClientResponseError && (err.status === 400 || err.status === 404)) return null;
      throw err;
    }
  },

  async update(id: string, data: Partial<Omit<UserRecord, "id">> & { last_seen_at?: string }): Promise<UserRecord> {
    await ensureAdminAuth();
    return pb.collection(COLLECTION).update<UserRecord>(id, data);
  },
};
