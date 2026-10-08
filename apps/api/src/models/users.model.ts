import { ClientResponseError, type RecordModel } from "pocketbase";
import { anonymousClient, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { UserRecord } from "../types/domain.js";
import type { UserRow } from "../types/records.js";

const COLLECTION = "users";

/** Usuario con rol y cliente expandidos, para la administración. */
export type AdminUserRow = UserRecord &
  RecordModel & {
    last_seen_at: string;
    created: string;
    expand?: { role?: { id: string; code: string; name: string; scope: "staff" | "client" }; client?: { id: string; name: string } };
  };

export interface UserListCriteria {
  search?: string;
  roleId?: string;
  clientId?: string;
  /** "staff" = sin cliente. */
  scope?: "staff" | "client";
  status?: string;
}

const ADMIN_EXPAND = "role,client";
const ADMIN_FIELDS =
  "id,email,name,phone,role,client,status,language,timezone,last_seen_at,created,expand.role.id,expand.role.code,expand.role.name,expand.role.scope,expand.client.id,expand.client.name";

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

  async listForAdmin(c: UserListCriteria): Promise<AdminUserRow[]> {
    await ensureAdminAuth();
    const parts: string[] = [];
    if (c.search) parts.push(pb.filter("(name ~ {:q} || email ~ {:q} || phone ~ {:q})", { q: c.search }));
    if (c.roleId) parts.push(pb.filter("role = {:r}", { r: c.roleId }));
    if (c.clientId) parts.push(pb.filter("client = {:c}", { c: c.clientId }));
    if (c.scope) parts.push(pb.filter("role.scope = {:s}", { s: c.scope }));
    if (c.status) parts.push(pb.filter("status = {:st}", { st: c.status }));
    return pb.collection(COLLECTION).getFullList<AdminUserRow>({
      filter: parts.join(" && "),
      sort: "name,email",
      expand: ADMIN_EXPAND,
      fields: ADMIN_FIELDS,
    });
  },

  async findForAdmin(id: string): Promise<AdminUserRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection(COLLECTION).getOne<AdminUserRow>(id, { expand: ADMIN_EXPAND, fields: ADMIN_FIELDS });
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  async emailTaken(email: string, exceptId = ""): Promise<boolean> {
    await ensureAdminAuth();
    const res = await pb.collection(COLLECTION).getList(1, 1, { filter: pb.filter("email = {:email} && id != {:id}", { email, id: exceptId }), fields: "id" });
    return res.totalItems > 0;
  },

  async create(data: Record<string, unknown> & { email: string; password: string }): Promise<UserRecord> {
    await ensureAdminAuth();
    return pb.collection(COLLECTION).create<UserRecord>({ ...data, passwordConfirm: data.password, emailVisibility: true, verified: true });
  },

  /** Dueños activos (para no dejar la instancia sin ninguno). */
  async activeOwnerIds(): Promise<string[]> {
    await ensureAdminAuth();
    const rows = await pb.collection(COLLECTION).getFullList({ filter: "status != 'suspended' && role.code = 'owner'", fields: "id" });
    return rows.map((r) => r.id);
  },

  /** Cuántos usuarios hay por cliente (para la lista de clientes). */
  async countByClient(): Promise<Map<string, number>> {
    await ensureAdminAuth();
    const rows = await pb.collection(COLLECTION).getFullList<RecordModel & { client: string }>({ filter: "client != ''", fields: "client" });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.client, (counts.get(r.client) ?? 0) + 1);
    return counts;
  },

  async notifiedUserIds(): Promise<Set<string>> {
    await ensureAdminAuth();
    const rows = await pb.collection("client_contacts").getFullList<RecordModel & { user: string }>({ filter: "receives_notifications = true", fields: "user" });
    return new Set(rows.map((r) => r.user));
  },

  async notifiedClientIds(userId: string): Promise<string[]> {
    await ensureAdminAuth();
    const rows = await pb.collection("client_contacts").getFullList<RecordModel & { client: string }>({
      filter: pb.filter("user = {:u} && receives_notifications = true", { u: userId }),
      fields: "client",
    });
    return rows.map((r) => r.client);
  },

  /** Marca o desmarca al usuario como contacto que recibe los avisos de su empresa. */
  async setClientContact(userId: string, clientId: string, receives: boolean): Promise<void> {
    await ensureAdminAuth();
    const rows = await pb.collection("client_contacts").getFullList<RecordModel & { client: string }>({
      filter: pb.filter("user = {:u}", { u: userId }),
    });
    for (const row of rows) {
      if (row.client !== clientId || !receives) await pb.collection("client_contacts").delete(row.id);
    }
    if (receives && clientId && !rows.some((r) => r.client === clientId)) {
      await pb.collection("client_contacts").create({ client: clientId, user: userId, contact_type: "primary", receives_notifications: true });
    }
  },

  async workload(userId: string): Promise<{ openAssigned: number; requested: number }> {
    await ensureAdminAuth();
    const open = "deleted_at = '' && status_category != 'resolved' && status_category != 'closed' && status_category != 'cancelled'";
    const [assigned, requested] = await Promise.all([
      pb.collection("work_items").getList(1, 1, { filter: `${pb.filter("assignee = {:u}", { u: userId })} && ${open}`, fields: "id" }),
      pb.collection("work_items").getList(1, 1, { filter: `${pb.filter("requester = {:u}", { u: userId })} && deleted_at = ''`, fields: "id" }),
    ]);
    return { openAssigned: assigned.totalItems, requested: requested.totalItems };
  },

  async activeSessions(userId: string): Promise<number> {
    await ensureAdminAuth();
    const res = await pb.collection("sessions").getList(1, 1, {
      filter: pb.filter("user = {:u} && revoked_at = '' && expires_at > {:now}", { u: userId, now: new Date().toISOString().replace("T", " ") }),
      fields: "id",
    });
    return res.totalItems;
  },
};
