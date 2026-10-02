import type { FastifyRequest } from "fastify";
import { permissionService } from "../services/permission.service.js";
import { Errors } from "../utils/errors.js";

/** preHandler que exige un permiso (`work_item.view`, `settings.manage`…). Va después de `authenticate`. */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.auth) throw Errors.unauthorized();
    if (!(await permissionService.has(request.auth.roleId, permission))) throw Errors.forbidden();
  };
}
