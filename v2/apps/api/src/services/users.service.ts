import { rolesModel } from "../models/roles.model.js";
import { usersModel } from "../models/users.model.js";
import type { UserRecord } from "../types/domain.js";
import { Errors } from "../utils/errors.js";
import { assertCan, type Actor } from "./actor.service.js";

function invalid(field: string) {
  return Errors.validation([{ field, code: "invalid_user", message: "" }]);
}

export const usersService = {
  /** El usuario existe, no está suspendido y es del personal (se le pueden asignar casos). */
  async assertStaff(userId: string, field = "assigneeId"): Promise<UserRecord> {
    const user = await usersModel.findById(userId);
    if (!user || user.status === "suspended") throw invalid(field);
    const role = await rolesModel.findById(user.role);
    if (role?.scope !== "staff") throw invalid(field);
    return user;
  },

  async findActive(userId: string, field: string): Promise<UserRecord> {
    const user = await usersModel.findById(userId);
    if (!user || user.status === "suspended") throw invalid(field);
    return user;
  },

  async assignable(actor: Actor) {
    if (actor.isClient) throw Errors.forbidden();
    assertCan(actor, "work_item.view");
    const users = await usersModel.listByScope("staff");
    return users.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, role: u.expand?.role?.code ?? null }));
  },

  async clientContacts(actor: Actor, clientId: string) {
    if (actor.isClient) throw Errors.forbidden();
    assertCan(actor, "work_item.create");
    const users = await usersModel.listByScope("client", clientId);
    return users.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, role: u.expand?.role?.code ?? null }));
  },
};
