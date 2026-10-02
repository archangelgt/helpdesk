import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { SessionRecord } from "../types/domain.js";

const COLLECTION = "sessions";

export const sessionsModel = {
  async create(data: {
    user: string;
    refresh_token_hash: string;
    expires_at: Date;
    ip: string;
    user_agent: string;
  }): Promise<SessionRecord> {
    await ensureAdminAuth();
    return pb.collection(COLLECTION).create<SessionRecord>({
      ...data,
      expires_at: data.expires_at.toISOString(),
      last_used_at: new Date().toISOString(),
    });
  },

  async findActiveByHash(hash: string): Promise<SessionRecord | null> {
    await ensureAdminAuth();
    const filter = pb.filter('refresh_token_hash = {:hash} && revoked_at = "" && expires_at > {:now}', {
      hash,
      now: new Date(),
    });
    const result = await pb.collection(COLLECTION).getList<SessionRecord>(1, 1, { filter });
    return result.items[0] ?? null;
  },

  async rotate(id: string, hash: string, expiresAt: Date, ip: string): Promise<void> {
    await ensureAdminAuth();
    await pb.collection(COLLECTION).update(id, {
      refresh_token_hash: hash,
      expires_at: expiresAt.toISOString(),
      last_used_at: new Date().toISOString(),
      ip,
    });
  },

  async revoke(id: string): Promise<void> {
    await ensureAdminAuth();
    await pb.collection(COLLECTION).update(id, { revoked_at: new Date().toISOString() });
  },

  async revokeAllForUser(userId: string): Promise<number> {
    await ensureAdminAuth();
    const filter = pb.filter('user = {:userId} && revoked_at = ""', { userId });
    const active = await pb.collection(COLLECTION).getFullList<SessionRecord>({ filter, fields: "id" });
    const now = new Date().toISOString();
    await Promise.all(active.map((s) => pb.collection(COLLECTION).update(s.id, { revoked_at: now })));
    return active.length;
  },
};
