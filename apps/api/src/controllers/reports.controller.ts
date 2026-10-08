import type { FastifyReply, FastifyRequest } from "fastify";
import { actorOf } from "../middlewares/authenticate.js";
import { reportsService } from "../services/reports.service.js";
import { parse } from "../validators/common.js";
import { reportQuerySchema } from "../validators/reports.validators.js";

export const reportsController = {
  async overview(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await reportsService.overview(actorOf(request), parse(reportQuerySchema, request.query)));
  },
};
