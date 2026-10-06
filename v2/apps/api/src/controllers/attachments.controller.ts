import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import type { FastifyReply, FastifyRequest } from "fastify";
import { actorOf } from "../middlewares/authenticate.js";
import { attachmentsService } from "../services/attachments.service.js";
import { AppError } from "../utils/errors.js";
import { parse } from "../validators/common.js";
import { idParamSchema, uploadTargetSchema } from "../validators/work-items.validators.js";

/** Tipos que el navegador puede mostrar sin riesgo; el resto (html, svg…) se fuerza a descarga. */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

function fieldValues(fields: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = (field as { type?: string; value?: unknown } | undefined)?.value;
    if ((field as { type?: string }).type === "field" && typeof value === "string" && value) values[name] = value;
  }
  return values;
}

export const attachmentsController = {
  async upload(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    const file = await request.file();
    if (!file) throw new AppError(400, "attachment.missing_file");
    const content = await file.toBuffer();
    const target = parse(uploadTargetSchema, fieldValues(file.fields));
    const attachment = await attachmentsService.upload(
      actorOf(request),
      id,
      { fileName: file.filename.slice(0, 200) || "archivo", mimeType: file.mimetype || "application/octet-stream", content },
      target,
    );
    return reply.status(201).send(attachment);
  },

  async download(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    const file = await attachmentsService.download(actorOf(request), id);
    const disposition = INLINE_TYPES.has(file.mimeType) ? "inline" : "attachment";
    const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return reply
      .header("Content-Type", file.mimeType)
      .header("Content-Disposition", `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .header("Cache-Control", "private, max-age=300")
      .send(Readable.fromWeb(file.body as unknown as WebReadableStream));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parse(idParamSchema, request.params);
    await attachmentsService.remove(actorOf(request), id);
    return reply.status(204).send();
  },
};
