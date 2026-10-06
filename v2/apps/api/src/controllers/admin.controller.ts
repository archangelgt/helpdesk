import type { FastifyReply, FastifyRequest } from "fastify";
import { actorOf } from "../middlewares/authenticate.js";
import { clientsService, notificationsAdminService, templatesService } from "../services/admin.service.js";
import { usersService } from "../services/users.service.js";
import {
  clientContactsQuerySchema,
  createClientSchema,
  listClientsSchema,
  templatesQuerySchema,
  testEmailSchema,
  updateClientSchema,
} from "../validators/admin.validators.js";
import { parse } from "../validators/common.js";
import { idParamSchema } from "../validators/work-items.validators.js";

export const adminController = {
  async listClients(request: FastifyRequest, reply: FastifyReply) {
    const { q } = parse(listClientsSchema, request.query);
    return reply.send({ items: await clientsService.list(actorOf(request), q) });
  },

  async createClient(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(201).send(await clientsService.create(actorOf(request), parse(createClientSchema, request.body)));
  },

  async updateClient(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    return reply.send(await clientsService.update(actorOf(request), id, parse(updateClientSchema, request.body)));
  },

  async assignableUsers(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await usersService.assignable(actorOf(request)) });
  },

  async clientContacts(request: FastifyRequest, reply: FastifyReply) {
    const { clientId } = parse(clientContactsQuerySchema, request.query);
    return reply.send({ items: await usersService.clientContacts(actorOf(request), clientId) });
  },

  async templates(request: FastifyRequest, reply: FastifyReply) {
    const { type } = parse(templatesQuerySchema, request.query);
    return reply.send({ items: await templatesService.list(actorOf(request), type) });
  },

  async notificationsStatus(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await notificationsAdminService.status(actorOf(request)));
  },

  async sendTestEmail(request: FastifyRequest, reply: FastifyReply) {
    const { to } = parse(testEmailSchema, request.body);
    return reply.send(await notificationsAdminService.sendTest(actorOf(request), to));
  },
};
