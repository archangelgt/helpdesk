import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", {
    config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_PER_MINUTE, timeWindow: "1 minute" } },
    handler: authController.login,
  });
  app.post("/refresh", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } }, handler: authController.refresh });
  app.post("/logout", authController.logout);
  app.post("/logout-all", { preHandler: authenticate, handler: authController.logoutAll });
  app.get("/jwks.json", authController.jwks);
}
