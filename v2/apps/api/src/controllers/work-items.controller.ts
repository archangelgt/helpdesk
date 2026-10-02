import type { FastifyReply, FastifyRequest } from "fastify";
import { actorOf } from "../middlewares/authenticate.js";
import { clientRequestsService } from "../services/client-requests.service.js";
import { commentsService } from "../services/comments.service.js";
import { stagesService } from "../services/stages.service.js";
import { workItemsService } from "../services/work-items.service.js";
import { parse } from "../validators/common.js";
import {
  checklistCreateSchema,
  checklistUpdateSchema,
  commentSchema,
  createClientRequestSchema,
  createStageSchema,
  createWorkItemSchema,
  idParamSchema,
  listWorkItemsSchema,
  reviewClientRequestSchema,
  submitClientRequestSchema,
  transitionSchema,
  updateStageSchema,
  updateWorkItemSchema,
} from "../validators/work-items.validators.js";

const idOf = (request: FastifyRequest) => parse(idParamSchema, request.params).id;

export const workItemsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await workItemsService.list(actorOf(request), parse(listWorkItemsSchema, request.query)));
  },

  async summary(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await workItemsService.summary(actorOf(request)));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await workItemsService.get(actorOf(request), idOf(request)));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const item = await workItemsService.create(actorOf(request), parse(createWorkItemSchema, request.body));
    return reply.status(201).send(item);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await workItemsService.update(actorOf(request), idOf(request), parse(updateWorkItemSchema, request.body)));
  },

  async transition(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await workItemsService.transition(actorOf(request), idOf(request), parse(transitionSchema, request.body)));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    await workItemsService.remove(actorOf(request), idOf(request));
    return reply.status(204).send();
  },

  async activity(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ items: await workItemsService.activity(actorOf(request), idOf(request)) });
  },

  async addComment(request: FastifyRequest, reply: FastifyReply) {
    const items = await commentsService.create(actorOf(request), idOf(request), parse(commentSchema, request.body));
    return reply.status(201).send({ items });
  },

  async addStage(request: FastifyRequest, reply: FastifyReply) {
    const item = await stagesService.create(actorOf(request), idOf(request), parse(createStageSchema, request.body));
    return reply.status(201).send(item);
  },

  async addChecklistItem(request: FastifyRequest, reply: FastifyReply) {
    const { title } = parse(checklistCreateSchema, request.body);
    return reply.status(201).send(await stagesService.addChecklistItem(actorOf(request), { workItemId: idOf(request) }, title));
  },

  async addClientRequest(request: FastifyRequest, reply: FastifyReply) {
    const item = await clientRequestsService.create(actorOf(request), idOf(request), parse(createClientRequestSchema, request.body));
    return reply.status(201).send(item);
  },
};

export const stagesController = {
  async update(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await stagesService.update(actorOf(request), idOf(request), parse(updateStageSchema, request.body)));
  },

  async transition(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await stagesService.transition(actorOf(request), idOf(request), parse(transitionSchema, request.body)));
  },

  async addChecklistItem(request: FastifyRequest, reply: FastifyReply) {
    const { title } = parse(checklistCreateSchema, request.body);
    return reply.status(201).send(await stagesService.addChecklistItem(actorOf(request), { stageId: idOf(request) }, title));
  },

  async updateChecklistItem(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await stagesService.updateChecklistItem(actorOf(request), idOf(request), parse(checklistUpdateSchema, request.body)));
  },
};

export const clientRequestsController = {
  async submit(request: FastifyRequest, reply: FastifyReply) {
    const { note } = parse(submitClientRequestSchema, request.body ?? {});
    return reply.send(await clientRequestsService.submit(actorOf(request), idOf(request), note));
  },

  async review(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await clientRequestsService.review(actorOf(request), idOf(request), parse(reviewClientRequestSchema, request.body)));
  },
};
