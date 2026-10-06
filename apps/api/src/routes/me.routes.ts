import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { meController } from "../controllers/me.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", meController.get);
  app.patch("/preferences", meController.updatePreferences);
  app.post("/password", {
    config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_PER_MINUTE, timeWindow: "1 minute" } },
    handler: meController.changePassword,
  });
}
