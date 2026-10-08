import type { FastifyReply, FastifyRequest } from "fastify";
import { actorOf } from "../middlewares/authenticate.js";
import { usersAdminService } from "../services/users-admin.service.js";
import { parse } from "../validators/common.js";
import { createUserSchema, listUsersSchema, resetPasswordSchema, updateUserSchema } from "../validators/users.validators.js";
import { idParamSchema } from "../validators/work-items.validators.js";

export const usersController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await usersAdminService.list(actorOf(request), parse(listUsersSchema, request.query)) });
  },

  async roles(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await usersAdminService.roles(actorOf(request)) });
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    return reply.send(await usersAdminService.get(actorOf(request), id));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(201).send(await usersAdminService.create(actorOf(request), parse(createUserSchema, request.body)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    return reply.send(await usersAdminService.update(actorOf(request), id, parse(updateUserSchema, request.body)));
  },

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    return reply.send(await usersAdminService.resetPassword(actorOf(request), id, parse(resetPasswordSchema, request.body ?? {})));
  },
};
