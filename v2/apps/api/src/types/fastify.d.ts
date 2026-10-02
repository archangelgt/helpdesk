import "fastify";
import type { Language } from "../config/constants.js";
import type { AuthContext } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    lang: Language;
    auth?: AuthContext;
  }
}
