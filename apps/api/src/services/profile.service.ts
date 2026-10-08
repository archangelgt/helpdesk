import { clientsModel } from "../models/clients.model.js";
import { rolesModel } from "../models/roles.model.js";
import { sessionsModel } from "../models/sessions.model.js";
import { usersModel } from "../models/users.model.js";
import type { UserProfile } from "../types/domain.js";
import { Errors } from "../utils/errors.js";
import type { ChangePasswordInput, PreferencesInput } from "../validators/me.validators.js";
import { permissionService } from "./permission.service.js";
import { settingsService } from "./settings.service.js";

export const profileService = {
  async get(userId: string): Promise<UserProfile> {
    const user = await usersModel.findById(userId);
    if (!user) throw Errors.unauthorized();
    const [role, client, defaults] = await Promise.all([
      rolesModel.findById(user.role),
      clientsModel.findSummary(user.client),
      settingsService.current(),
    ]);
    const permissions = role ? [...(await permissionService.forRole(role.id))] : [];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role ? { code: role.code, name: role.name, scope: role.scope } : null,
      client,
      language: user.language || defaults.defaultLanguage,
      colorMode: user.color_mode || defaults.colorMode,
      theme: user.theme || defaults.theme,
      permissions,
    };
  },

  /** Cambia la contraseña y cierra las demás sesiones del usuario (la actual sigue abierta). */
  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput): Promise<{ closedSessions: number }> {
    const user = await usersModel.findById(userId);
    if (!user) throw Errors.unauthorized();
    if (!(await usersModel.verifyPassword(user.email, input.currentPassword))) throw Errors.currentPasswordInvalid();
    if (input.currentPassword === input.newPassword) throw Errors.validation([{ field: "newPassword", code: "same_password", message: "" }]);
    await usersModel.setPassword(userId, input.newPassword);
    return { closedSessions: await sessionsModel.revokeAllForUser(userId, sessionId) };
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
