import type { FastifyReply, FastifyRequest } from "fastify";
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "../config/constants.js";
import { env } from "../config/env.js";
import { authService, type AuthResult } from "../services/auth.service.js";
import { profileService } from "../services/profile.service.js";
import { tokenService } from "../services/token.service.js";
import type { RequestMeta } from "../types/auth.js";
import { loginSchema } from "../validators/auth.validators.js";
import { parse } from "../validators/common.js";

function meta(request: FastifyRequest): RequestMeta {
  return { ip: request.ip, userAgent: request.headers["user-agent"] ?? "" };
}

function setRefreshCookie(reply: FastifyReply, result: AuthResult) {
  reply.setCookie(REFRESH_COOKIE, result.refreshToken, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    expires: result.refreshExpiresAt,
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH, httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "strict" });
}

async function respondWithSession(reply: FastifyReply, result: AuthResult) {
  setRefreshCookie(reply, result);
  const user = await profileService.get(result.userId);
  return reply.send({ accessToken: result.accessToken, tokenType: "Bearer", expiresIn: result.expiresIn, user });
}

export const authController = {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = parse(loginSchema, request.body);
    const result = await authService.login(input.email, input.password, meta(request));
    return respondWithSession(reply, result);
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await authService.refresh(request.cookies[REFRESH_COOKIE], meta(request));
      return await respondWithSession(reply, result);
    } catch (err) {
      clearRefreshCookie(reply);
      throw err;
    }
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    await authService.logout(request.cookies[REFRESH_COOKIE]);
    clearRefreshCookie(reply);
    return reply.status(204).send();
  },

  async logoutAll(request: FastifyRequest, reply: FastifyReply) {
    const revoked = await authService.logoutAll(request.auth!.userId);
    clearRefreshCookie(reply);
    return reply.send({ revokedSessions: revoked });
  },

  async jwks(_request: FastifyRequest, reply: FastifyReply) {
    return reply.header("Cache-Control", "public, max-age=3600").send(await tokenService.jwks());
  },
};
