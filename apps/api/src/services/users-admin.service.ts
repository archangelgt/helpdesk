import { randomInt } from "node:crypto";
import { clientsModel } from "../models/clients.model.js";
import { rolesModel } from "../models/roles.model.js";
import { sessionsModel } from "../models/sessions.model.js";
import { usersModel, type AdminUserRow } from "../models/users.model.js";
import type { Role } from "../types/domain.js";
import { Errors } from "../utils/errors.js";
import type { CreateUserInput, ListUsersQuery, ResetPasswordInput, UpdateUserInput } from "../validators/users.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { notificationDispatcher } from "./notifications/dispatcher.js";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Contraseña temporal legible (sin 0/O, 1/l/I) para dictarla o copiarla. */
function temporaryPassword(): string {
  let out = "";
  for (let i = 0; i < 14; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return `${out.slice(0, 7)}-${out.slice(7)}`;
}

function userDto(u: AdminUserRow, notified: boolean) {
  const role = u.expand?.role;
  const client = u.expand?.client;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || null,
    role: role ? { id: role.id, code: role.code, name: role.name, scope: role.scope } : null,
    client: client ? { id: client.id, name: client.name } : null,
    status: u.status || "active",
    language: u.language || null,
    lastSeenAt: u.last_seen_at || null,
    created: u.created,
    receivesNotifications: notified,
  };
}

function assertManager(actor: Actor) {
  if (actor.isClient) throw Errors.forbidden();
  assertCan(actor, "user.manage");
}

async function roleOrFail(roleId: string): Promise<Role> {
  const role = (await rolesModel.list()).find((r) => r.id === roleId);
  if (!role) throw Errors.validation([{ field: "roleId", code: "invalid", message: "" }]);
  return role;
}

/** Los roles de cliente necesitan empresa; el personal no lleva empresa. */
async function clientFor(role: Role, clientId: string | null | undefined): Promise<string> {
  if (role.scope === "staff") return "";
  if (!clientId || !(await clientsModel.findById(clientId))) {
    throw Errors.validation([{ field: "clientId", code: "users.client_required", message: "" }]);
  }
  return clientId;
}

async function detail(id: string) {
  const user = await usersModel.findForAdmin(id);
  if (!user) throw Errors.notFound();
  const [notifiedClients, workload, activeSessions] = await Promise.all([
    usersModel.notifiedClientIds(id),
    usersModel.workload(id),
    usersModel.activeSessions(id),
  ]);
  return { ...userDto(user, notifiedClients.includes(user.client)), ...workload, activeSessions };
}

export const usersAdminService = {
  async list(actor: Actor, query: ListUsersQuery) {
    assertManager(actor);
    const [users, notified] = await Promise.all([
      usersModel.listForAdmin({ search: query.q, roleId: query.roleId, clientId: query.clientId, scope: query.scope, status: query.status }),
      usersModel.notifiedUserIds(),
    ]);
    return users.map((u) => userDto(u, notified.has(u.id)));
  },

  async get(actor: Actor, id: string) {
    assertManager(actor);
    return detail(id);
  },

  async roles(actor: Actor) {
    assertManager(actor);
    const roles = await rolesModel.list();
    return roles
      .filter((r) => actor.roleCode === "owner" || r.code !== "owner")
      .map((r) => ({ id: r.id, code: r.code, name: r.name, scope: r.scope }));
  },

  async create(actor: Actor, input: CreateUserInput) {
    assertManager(actor);
    const role = await roleOrFail(input.roleId);
    if (role.code === "owner" && actor.roleCode !== "owner") throw Errors.forbidden();
    const client = await clientFor(role, input.clientId);
    if (await usersModel.emailTaken(input.email)) throw Errors.conflict("users.email_taken");

    const generated = !input.password;
    const password = input.password ?? temporaryPassword();
    const user = await usersModel.create({
      email: input.email,
      password,
      name: input.name,
      phone: input.phone ?? "",
      role: role.id,
      client,
      status: "invited",
      language: input.language ?? "",
    });
    if (client && input.receivesNotifications) await usersModel.setClientContact(user.id, client, true);

    const welcome = input.sendWelcome ? await notificationDispatcher.sendAccess(user, "welcome", password) : null;
    return { user: await detail(user.id), temporaryPassword: generated ? password : null, emailSent: welcome?.ok ?? false, emailError: welcome?.error ?? null };
  },

  async update(actor: Actor, id: string, input: UpdateUserInput) {
    assertManager(actor);
    const user = await usersModel.findForAdmin(id);
    if (!user) throw Errors.notFound();
    const currentRole = user.expand?.role ?? null;
    const role = input.roleId ? await roleOrFail(input.roleId) : currentRole;
    if (!role) throw Errors.validation([{ field: "roleId", code: "invalid", message: "" }]);

    const touchesOwner = currentRole?.code === "owner" || role.code === "owner";
    if (touchesOwner && actor.roleCode !== "owner") throw Errors.forbidden();

    const roleChanged = role.id !== user.role;
    const suspending = input.status === "suspended" && user.status !== "suspended";
    if (id === actor.userId && (roleChanged || suspending)) throw Errors.conflict("users.cannot_change_self");
    if (currentRole?.code === "owner" && user.status !== "suspended" && (role.code !== "owner" || suspending)) {
      const owners = await usersModel.activeOwnerIds();
      if (owners.length <= 1) throw Errors.conflict("users.last_owner");
    }

    const clientChanging = input.clientId !== undefined || roleChanged;
    const client = clientChanging ? await clientFor(role, input.clientId === undefined ? user.client : input.clientId) : user.client;
    if (input.email && input.email !== user.email && (await usersModel.emailTaken(input.email, id))) throw Errors.conflict("users.email_taken");

    await usersModel.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.language !== undefined && { language: input.language ?? "" }),
      ...(input.status !== undefined && { status: input.status }),
      ...(roleChanged && { role: role.id }),
      ...(client !== user.client && { client }),
    });

    if (client !== user.client || input.receivesNotifications !== undefined) {
      const receives = input.receivesNotifications ?? (await usersModel.notifiedClientIds(id)).includes(user.client);
      await usersModel.setClientContact(id, client, Boolean(client) && receives);
    }
    // Rol, empresa o estado viajan en el token: se cierran sus sesiones para que entre con los datos nuevos.
    if (roleChanged || client !== user.client || suspending || (input.email && input.email !== user.email)) {
      await sessionsModel.revokeAllForUser(id);
    }
    return detail(id);
  },

  async resetPassword(actor: Actor, id: string, input: ResetPasswordInput) {
    assertManager(actor);
    const user = await usersModel.findForAdmin(id);
    if (!user) throw Errors.notFound();
    if (user.expand?.role?.code === "owner" && actor.roleCode !== "owner") throw Errors.forbidden();
    if (id === actor.userId) throw Errors.conflict("users.use_account_page");

    const generated = !input.password;
    const password = input.password ?? temporaryPassword();
    await usersModel.setPassword(id, password);
    const closedSessions = await sessionsModel.revokeAllForUser(id);
    const mail = input.sendEmail ? await notificationDispatcher.sendAccess(user, "reset", password) : null;
    return { temporaryPassword: generated ? password : null, closedSessions, emailSent: mail?.ok ?? false, emailError: mail?.error ?? null };
  },
};
