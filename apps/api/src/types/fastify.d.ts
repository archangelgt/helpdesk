import "fastify";
import type { Language } from "../config/constants.js";
import type { Actor } from "../services/actor.service.js";
import type { AuthContext } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    lang: Language;
    auth?: AuthContext;
    actor?: Actor;
  }
}
