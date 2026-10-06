import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ClientResponseError } from "pocketbase";
import { t } from "../i18n/index.js";
import { AppError } from "../utils/errors.js";

function send(reply: FastifyReply, request: FastifyRequest, status: number, code: string, details?: unknown) {
  return reply.status(status).send({
    error: { code, message: t(request.lang ?? "es", code), ...(details ? { details } : {}) },
  });
}

/** Las validaciones de PocketBase (relación inexistente, regla de integridad de un hook…) llegan como 400. */
function pocketbaseDetails(error: ClientResponseError) {
  const data = (error.response?.data ?? {}) as Record<string, { code?: string; message?: string }>;
  const fields = Object.entries(data).map(([field, v]) => ({ field, code: v?.code ?? "invalid", message: v?.message ?? "" }));
  return fields.length ? fields : [{ field: "", code: "invalid", message: String(error.response?.message ?? "") }];
}

export function errorHandler(error: FastifyError | AppError | ClientResponseError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    if (error.status >= 500) request.log.error({ err: error, details: error.details }, error.code);
    return send(reply, request, error.status, error.code, error.status < 500 ? error.details : undefined);
  }

  if (error instanceof ClientResponseError) {
    if (error.status === 400) return send(reply, request, 400, "validation.invalid", pocketbaseDetails(error));
    if (error.status === 404) return send(reply, request, 404, "common.not_found");
    request.log.error({ err: error, response: error.response }, "pocketbase error");
    return send(reply, request, 500, "common.internal_error");
  }

  if ("statusCode" in error && error.statusCode === 429) return send(reply, request, 429, "common.too_many_requests");
  if ("code" in error && error.code === "FST_REQ_FILE_TOO_LARGE") return send(reply, request, 413, "attachment.too_large");
  if ("statusCode" in error && error.statusCode && error.statusCode < 500) {
    return send(reply, request, error.statusCode, "validation.invalid");
  }

  request.log.error({ err: error }, "unhandled error");
  return send(reply, request, 500, "common.internal_error");
}
