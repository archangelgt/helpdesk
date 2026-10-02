import type { FastifyReply, FastifyRequest } from "fastify";
import { catalogService } from "../services/catalog.service.js";
import { categoriesQuerySchema } from "../validators/admin.validators.js";
import { statusesQuerySchema } from "../validators/catalog.validators.js";
import { parse } from "../validators/common.js";

export const catalogController = {
  async workItemTypes(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await catalogService.workItemTypes() });
  },

  async statuses(request: FastifyRequest, reply: FastifyReply) {
    const { workflow } = parse(statusesQuerySchema, request.query);
    return reply.send({ items: await catalogService.statuses(workflow) });
  },

  async priorities(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await catalogService.priorities() });
  },

  async categories(request: FastifyRequest, reply: FastifyReply) {
    const { type } = parse(categoriesQuerySchema, request.query);
    return reply.send({ items: await catalogService.categories(type) });
  },

  async products(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await catalogService.products() });
  },

  async roles(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await catalogService.roles() });
  },
};
