import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { DEFAULT_LANGUAGE } from "./config/constants.js";
import { Errors } from "./utils/errors.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { detectLanguage } from "./middlewares/language.js";
import { registerRoutes } from "./routes/index.js";
import { MAX_ATTACHMENT_BYTES } from "./services/attachment-rules.js";

export async function buildApp() {
  const app = Fastify({
    trustProxy: (_address: string, hop: number) => hop < env.TRUST_PROXY_HOPS,
    bodyLimit: 1_048_576,
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    },
  });

  app.decorateRequest("lang", DEFAULT_LANGUAGE);
  app.addHook("onRequest", detectLanguage);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request) => {
    request.log.debug({ url: request.url }, "route not found");
    throw Errors.notFound();
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", reply.getHeader("Cache-Control") ?? "no-store");
  });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 10 } });
  await app.register(rateLimit, { global: false });
  await registerRoutes(app);

  return app;
}
