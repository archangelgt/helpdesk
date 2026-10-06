import type { FastifyReply, FastifyRequest } from "fastify";
import { pocketbaseHealthy } from "../db/pocketbase.js";

export const healthController = {
  async check(_request: FastifyRequest, reply: FastifyReply) {
    const database = await pocketbaseHealthy();
    return reply.status(database ? 200 : 503).send({ status: database ? "ok" : "degraded", database });
  },
};
