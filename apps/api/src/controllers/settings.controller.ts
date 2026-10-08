import type { FastifyReply, FastifyRequest } from "fastify";
import { actorOf } from "../middlewares/authenticate.js";
import { settingsService } from "../services/settings.service.js";
import { parse } from "../validators/common.js";
import { holidaySchema, senderSchema, settingsPatchSchema, updateRuleSchema, workingDaysSchema } from "../validators/settings.validators.js";
import { idParamSchema } from "../validators/work-items.validators.js";

export const settingsController = {
  async publicSettings(_request: FastifyRequest, reply: FastifyReply) {
    return reply.header("Cache-Control", "public, max-age=60").send(await settingsService.publicSettings());
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await settingsService.get(actorOf(request)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await settingsService.update(actorOf(request), parse(settingsPatchSchema, request.body)));
  },

  async updateSender(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await settingsService.updateSender(actorOf(request), parse(senderSchema, request.body)));
  },

  async updateRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    return reply.send({ items: await settingsService.updateRule(actorOf(request), id, parse(updateRuleSchema, request.body)) });
  },

  async setWorkingDays(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await settingsService.setWorkingDays(actorOf(request), parse(workingDaysSchema, request.body)));
  },

  async addHoliday(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(201).send(await settingsService.addHoliday(actorOf(request), parse(holidaySchema, request.body)));
  },

  async removeHoliday(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    return reply.send(await settingsService.removeHoliday(actorOf(request), id));
  },
};
