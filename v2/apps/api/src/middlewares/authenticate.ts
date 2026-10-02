import type { FastifyRequest } from "fastify";
import { tokenService } from "../services/token.service.js";
import { Errors } from "../utils/errors.js";

export async function authenticate(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw Errors.unauthorized();
  const claims = await tokenService.verifyAccessToken(header.slice(7));
  request.auth = {
    userId: claims.sub,
    sessionId: claims.sid,
    roleCode: claims.role,
    roleId: claims.roleId,
    clientId: claims.client,
  };
}
