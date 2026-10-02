import type { FastifyReply, FastifyRequest } from "fastify";
import { profileService } from "../services/profile.service.js";
import { parse } from "../validators/common.js";
import { preferencesSchema } from "../validators/me.validators.js";

export const meController = {
  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await profileService.get(request.auth!.userId));
  },

  async updatePreferences(request: FastifyRequest, reply: FastifyReply) {
    const input = parse(preferencesSchema, request.body);
    return reply.send(await profileService.updatePreferences(request.auth!.userId, input));
  },
};
