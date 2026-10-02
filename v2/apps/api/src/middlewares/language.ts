import type { FastifyRequest } from "fastify";
import { pickLanguage } from "../i18n/index.js";

/** Idioma de la respuesta: el que pide el cliente (la web envía el idioma elegido) o español. */
export async function detectLanguage(request: FastifyRequest): Promise<void> {
  request.lang = pickLanguage(request.headers["accept-language"]);
}
