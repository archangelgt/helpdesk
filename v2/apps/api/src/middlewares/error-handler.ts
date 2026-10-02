import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { t } from "../i18n/index.js";
import { AppError } from "../utils/errors.js";

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  const lang = request.lang ?? "es";

  if (error instanceof AppError) {
    return reply.status(error.status).send({
      error: { code: error.code, message: t(lang, error.code), ...(error.details ? { details: error.details } : {}) },
    });
  }

  if ("statusCode" in error && error.statusCode === 429) {
    return reply.status(429).send({ error: { code: "common.too_many_requests", message: t(lang, "common.too_many_requests") } });
  }

  if ("statusCode" in error && error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: { code: "validation.invalid", message: t(lang, "validation.invalid") } });
  }

  request.log.error({ err: error }, "unhandled error");
  return reply.status(500).send({ error: { code: "common.internal_error", message: t(lang, "common.internal_error") } });
}
