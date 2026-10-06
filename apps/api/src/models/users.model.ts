import { ClientResponseError } from "pocketbase";
import { anonymousClient, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { UserRecord } from "../types/domain.js";
import type { UserRow } from "../types/records.js";

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

  async setPassword(id: string, password: string): Promise<void> {
    await ensureAdminAuth();
    await pb.collection(COLLECTION).update(id, { password, passwordConfirm: password });
  },

  /** Usuarios activos cuyo rol tiene alcance `scope` (personal interno o de clientes). */
  async listByScope(scope: "staff" | "client", clientId?: string): Promise<(UserRow & { expand?: { role?: { code: string; name: string } } })[]> {
    await ensureAdminAuth();
    const filter = pb.filter(
      clientId ? "status != 'suspended' && role.scope = {:scope} && client = {:clientId}" : "status != 'suspended' && role.scope = {:scope}",
      { scope, clientId: clientId ?? "" },
    );
    return pb.collection(COLLECTION).getFullList({
      filter,
      sort: "name",
      expand: "role",
      fields: "id,name,email,role,client,status,expand.role.code,expand.role.name",
    });
  },
};
