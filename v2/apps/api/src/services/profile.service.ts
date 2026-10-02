import { clientsModel } from "../models/clients.model.js";
import { rolesModel } from "../models/roles.model.js";
import { usersModel } from "../models/users.model.js";
import type { UserProfile } from "../types/domain.js";
import { Errors } from "../utils/errors.js";
import type { PreferencesInput } from "../validators/me.validators.js";
import { permissionService } from "./permission.service.js";

export const profileService = {
  async get(userId: string): Promise<UserProfile> {
    const user = await usersModel.findById(userId);
    if (!user) throw Errors.unauthorized();
    const [role, client] = await Promise.all([rolesModel.findById(user.role), clientsModel.findSummary(user.client)]);
    const permissions = role ? [...(await permissionService.forRole(role.id))] : [];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role ? { code: role.code, name: role.name, scope: role.scope } : null,
      client,
      language: user.language || null,
      colorMode: user.color_mode || null,
      theme: user.theme || null,
      permissions,
    };
  },

  async updatePreferences(userId: string, input: PreferencesInput): Promise<UserProfile> {
    await usersModel.update(userId, {
      ...(input.language && { language: input.language }),
      ...(input.colorMode && { color_mode: input.colorMode }),
      ...(input.theme && { theme: input.theme }),
    });
    return this.get(userId);
  },
};
