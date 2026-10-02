import type { FastifyRequest } from "fastify";
import { Errors } from "../utils/errors.js";

/** preHandler que exige un permiso (`work_item.view`, `settings.manage`…). Va después de `authenticate`. */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.actor) throw Errors.unauthorized();
    if (!request.actor.can(permission)) throw Errors.forbidden();
  };
}
