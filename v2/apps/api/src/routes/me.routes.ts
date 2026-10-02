import type { FastifyInstance } from "fastify";
import { meController } from "../controllers/me.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", meController.get);
  app.patch("/preferences", meController.updatePreferences);
}
