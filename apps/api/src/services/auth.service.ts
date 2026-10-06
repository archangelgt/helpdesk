import { env } from "../config/env.js";
import { rolesModel } from "../models/roles.model.js";
import { sessionsModel } from "../models/sessions.model.js";
import { usersModel } from "../models/users.model.js";
import type { RequestMeta } from "../types/auth.js";
import type { Role, UserRecord } from "../types/domain.js";
import { randomToken, sha256 } from "../utils/crypto.js";
import { Errors } from "../utils/errors.js";
import { tokenService } from "./token.service.js";

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  userId: string;
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}

async function assertCanSignIn(user: UserRecord): Promise<Role> {
  if (user.status === "suspended") throw Errors.accountSuspended();
  const role = await rolesModel.findById(user.role);
  if (!role) throw Errors.accountWithoutRole();
  return role;
}

async function issueAccessToken(user: UserRecord, role: Role, sessionId: string) {
  return tokenService.signAccessToken({
    sub: user.id,
    sid: sessionId,
    role: role.code,
    roleId: role.id,
    client: user.client || null,
  });
}

export const authService = {
  async login(email: string, password: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await usersModel.verifyPassword(email, password);
    if (!user) throw Errors.invalidCredentials();
    const role = await assertCanSignIn(user);

    const refreshToken = randomToken();
    const refreshExpiresAt = refreshExpiry();
    const session = await sessionsModel.create({
      user: user.id,
      refresh_token_hash: sha256(refreshToken),
      expires_at: refreshExpiresAt,
      ip: meta.ip,
      user_agent: meta.userAgent.slice(0, 500),
    });

    const updates: Parameters<typeof usersModel.update>[1] = { last_seen_at: new Date().toISOString() };
    if (user.status === "invited") updates.status = "active";
    await usersModel.update(user.id, updates);

    const { token, expiresIn } = await issueAccessToken(user, role, session.id);
    return { accessToken: token, expiresIn, refreshToken, refreshExpiresAt, userId: user.id };
  },

  /** Rota el refresh token: el anterior deja de servir en cuanto se usa. */
  async refresh(refreshToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    if (!refreshToken) throw Errors.sessionExpired();
    const session = await sessionsModel.findActiveByHash(sha256(refreshToken));
    if (!session) throw Errors.sessionExpired();

    const user = await usersModel.findById(session.user);
    if (!user) {
      await sessionsModel.revoke(session.id);
      throw Errors.sessionExpired();
    }
    let role: Role;
    try {
      role = await assertCanSignIn(user);
    } catch (err) {
      await sessionsModel.revoke(session.id);
      throw err;
    }

    const nextToken = randomToken();
    const refreshExpiresAt = refreshExpiry();
    await sessionsModel.rotate(session.id, sha256(nextToken), refreshExpiresAt, meta.ip);
    const { token, expiresIn } = await issueAccessToken(user, role, session.id);
    return { accessToken: token, expiresIn, refreshToken: nextToken, refreshExpiresAt, userId: user.id };
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await sessionsModel.findActiveByHash(sha256(refreshToken));
    if (session) await sessionsModel.revoke(session.id);
  },

  async logoutAll(userId: string): Promise<number> {
    return sessionsModel.revokeAllForUser(userId);
  },
};
