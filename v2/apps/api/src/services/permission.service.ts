import { PERMISSION_CACHE_TTL_MS } from "../config/constants.js";
import { rolesModel } from "../models/roles.model.js";

const cache = new Map<string, { codes: Set<string>; expires: number }>();

export const permissionService = {
  async forRole(roleId: string): Promise<Set<string>> {
    const hit = cache.get(roleId);
    if (hit && hit.expires > Date.now()) return hit.codes;
    const codes = new Set(await rolesModel.permissionCodes(roleId));
    cache.set(roleId, { codes, expires: Date.now() + PERMISSION_CACHE_TTL_MS });
    return codes;
  },

  async has(roleId: string, permission: string): Promise<boolean> {
    return (await this.forRole(roleId)).has(permission);
  },

  clearCache(): void {
    cache.clear();
  },
};
