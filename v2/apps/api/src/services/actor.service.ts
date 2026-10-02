import { PERMISSION_CACHE_TTL_MS } from "../config/constants.js";
import { rolesModel } from "../models/roles.model.js";
import type { AuthContext } from "../types/auth.js";
import type { Role } from "../types/domain.js";
import { Errors } from "../utils/errors.js";
import { permissionService } from "./permission.service.js";

/** Quién hace la petición: lo que necesitan los services para autorizar y filtrar. */
export interface Actor {
  userId: string;
  roleId: string;
  roleCode: string;
  isClient: boolean;
  clientId: string | null;
  can(permission: string): boolean;
}

const roles = new Map<string, { role: Role; expires: number }>();

async function roleById(id: string): Promise<Role> {
  const hit = roles.get(id);
  if (hit && hit.expires > Date.now()) return hit.role;
  const role = await rolesModel.findById(id);
  if (!role) throw Errors.accountWithoutRole();
  roles.set(id, { role, expires: Date.now() + PERMISSION_CACHE_TTL_MS });
  return role;
}

export const actorService = {
  async fromAuth(auth: AuthContext): Promise<Actor> {
    const [role, permissions] = await Promise.all([roleById(auth.roleId), permissionService.forRole(auth.roleId)]);
    return {
      userId: auth.userId,
      roleId: role.id,
      roleCode: role.code,
      isClient: role.scope === "client",
      clientId: auth.clientId,
      can: (permission) => permissions.has(permission),
    };
  },
};

export function assertCan(actor: Actor, permission: string): void {
  if (!actor.can(permission)) throw Errors.forbidden();
}
